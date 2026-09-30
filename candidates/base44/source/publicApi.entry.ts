import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * API pública para el sitio web de Alsasa (servido por Vercel).
 * Reemplaza el backend de WordPress: listado de propiedades, detalle y captura de leads.
 * Sin autenticación (público). CORS habilitado para llamadas desde el navegador en alsasa.co.
 * No usa InvokeLLM (créditos agotados) — solo operaciones CRUD puras.
 */

class PublicInputError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

// Bound bytes actually received; Content-Length can be absent or forged.
// This is input validation, NOT a rate limit or a spending cap.
async function readPublicJson(req: Request) {
  const maxBytes = 65536;
  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PublicInputError('Solicitud demasiado grande.', 413);
  }
  if (!req.body) throw new PublicInputError('JSON inválido.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  // Total body deadline: receiving another chunk does not renew the window.
  // This bounds work inside this handler, not platform ingress or invocation costs.
  const deadline = Date.now() + 10000;
  let rejectRead = (_error: Error) => {};
  const interrupted = new Promise<never>((_resolve, reject) => { rejectRead = reject; });
  interrupted.catch(() => {});
  const timeoutError = () => new PublicInputError('Tiempo de recepción agotado.', 408);
  const onAbort = () => rejectRead(new PublicInputError('Solicitud interrumpida.', 400));
  const timer = setTimeout(() => rejectRead(timeoutError()), 10000);
  req.signal?.addEventListener('abort', onAbort, { once: true });
  const checkDeadline = () => {
    if (req.signal?.aborted) throw new PublicInputError('Solicitud interrumpida.', 400);
    if (Date.now() >= deadline) throw timeoutError();
  };
  try {
    while (true) {
      checkDeadline();
      const { done, value } = await Promise.race([reader.read(), interrupted]);
      checkDeadline();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        throw new PublicInputError('Solicitud demasiado grande.', 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    // Cancellation must not hold the response open if the transport does not settle.
    try { reader.cancel().catch(() => {}); } catch {}
    throw error;
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new PublicInputError('JSON inválido.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new PublicInputError('Datos inválidos.');
  }
  return body;
}

function publicText(value, max, optional = true) {
  if (value === undefined || value === null) {
    if (optional) return '';
    throw new PublicInputError('Falta un campo obligatorio.');
  }
  if (typeof value !== 'string' || value.length > max) {
    throw new PublicInputError('Texto inválido o demasiado largo.');
  }
  const text = value.trim();
  if (!optional && !text) throw new PublicInputError('Falta un campo obligatorio.');
  return text;
}


function optionalBudget(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!['string', 'number'].includes(typeof value) ||
      (typeof value === 'string' && !value.trim())) {
    throw new PublicInputError('Presupuesto inválido.');
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER) {
    throw new PublicInputError('Presupuesto inválido.');
  }
  return number;
}

async function requirePublicProperty(entities, id) {
  const matches = await entities.Property.filter({ id, web_visible: true, status: 'available' }, '-created_date', 2);
  if (!Array.isArray(matches) || matches.length !== 1 || matches[0].id !== id ||
      matches[0].web_visible !== true || matches[0].status !== 'available') {
    throw new PublicInputError('Referencia de propiedad no disponible.');
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

// Normaliza teléfono colombiano a formato E.164 y replica a whatsapp
const normalizePhone = (phone) => {
  if (!phone) return '';
  let p = String(phone).replace(/\D/g, '');
  if (p.length === 10) p = `+57${p}`;
  else if (p.length === 12 && !p.startsWith('+')) p = `+${p}`;
  return p;
};

// Public descriptions are plain text. Stop at private/contact blocks, including
// their continuation lines. This does not replace review of unlabelled personal data.
const sanitizePublicDescription = (value) => {
  if (typeof value !== 'string') return '';
  let text = value;
  // Decode common HTML entities before identifying labels; never emit markup.
  for (let pass = 0; pass < 3; pass++) {
    text = text
      .replace(/&#(x[0-9a-f]+|\d+);?/gi, (match, code) => {
        const point = code[0].toLowerCase() === 'x'
          ? parseInt(code.slice(1), 16) : Number(code);
        return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
      })
      .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, name) =>
        ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[name.toLowerCase()]);
  }
  text = text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '')
    .replace(/\r\n?/g, '\n');
  const kept = [];
  for (const line of text.split('\n')) {
    const normalized = line.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const privateLabel = /\b(propietari[oa]s?|duen[oa]s?|correo|e-?mail|celular|telefono|whatsapp|contacto|cedula|c\.?\s*c\.?|notas?\s+internas?|datos?\s+privados?|direccion\s+exacta)\b/i;
    const email = /[^\s@]+@[^\s@]+\.[^\s@]+/;
    const mobile = /(?:^|[^\d])(?:\+?57[\s().-]*)?3(?:[\s().-]*\d){9}(?![\s().-]*\d)/;
    if (privateLabel.test(normalized) || email.test(normalized) || mobile.test(normalized)) break;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

// Lista blanca estricta para impedir que dirección exacta, notas internas o PII salgan del CRM.
const toPublicProperty = (property) => ({
  id: property.id,
  custom_id: property.custom_id,
  title: property.title,
  public_location: property.public_location,
  price: property.price,
  property_type: property.property_type,
  listing_type: property.listing_type,
  status: property.status,
  bedrooms: property.bedrooms,
  bathrooms: property.bathrooms,
  square_feet: property.square_feet,
  description: sanitizePublicDescription(property.description),
  images: property.images,
  virtual_tour_url: property.virtual_tour_url,
  drone_video_url: property.drone_video_url,
  listing_date: property.listing_date,
});

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // ---------------- GET: propiedades ----------------
    if (req.method === 'GET') {
      const action = url.searchParams.get('action') || 'list';
      if (!['list', 'detail'].includes(action) || url.search.length > 4096) {
        throw new PublicInputError('Consulta inválida.');
      }
      for (const [key, max] of [['id',100], ['custom_id',100], ['listing_type',80], ['property_type',80], ['search',200]]) {
        publicText(url.searchParams.get(key), max);
      }
      for (const key of ['price_min','price_max','area_min','area_max','bedrooms']) {
        optionalBudget(url.searchParams.get(key));
      }
      const svc = createClientFromRequest(req).asServiceRole;

      // Detalle de una propiedad
      if (action === 'detail') {
        const id = url.searchParams.get('id');
        const customId = url.searchParams.get('custom_id');

        let property;
        if (id) {
          property = await svc.entities.Property.get(id);
        } else if (customId) {
          const matches = await svc.entities.Property.filter({ custom_id: customId });
          property = matches && matches[0];
        }

        if (!property) return json({ error: 'Propiedad no encontrada' }, 404);
        // Solo exponer propiedades activas y marcadas como públicas.
        if (property.web_visible !== true || property.status !== 'available') {
          return json({ error: 'Propiedad no disponible' }, 404);
        }

        return json({ property: toPublicProperty(property) });
      }

      // Listado público con filtros
      const filter = { web_visible: true, status: 'available' };
      const listingType = url.searchParams.get('listing_type');
      if (listingType) filter.listing_type = listingType;

      const propertyType = url.searchParams.get('property_type');
      if (propertyType) filter.property_type = propertyType;

      let properties = await svc.entities.Property.filter(filter, '-created_date', 200);

      // Filtros secundarios en memoria (precio, área, bedrooms, búsqueda)
      const priceMin = url.searchParams.get('price_min');
      const priceMax = url.searchParams.get('price_max');
      const areaMin = url.searchParams.get('area_min');
      const areaMax = url.searchParams.get('area_max');
      const bedrooms = url.searchParams.get('bedrooms');
      const search = url.searchParams.get('search');

      properties = properties.filter((p) => {
        if (priceMin && (p.price || 0) < Number(priceMin)) return false;
        if (priceMax && (p.price || 0) > Number(priceMax)) return false;
        if (areaMin && (p.square_feet || 0) < Number(areaMin)) return false;
        if (areaMax && (p.square_feet || 0) > Number(areaMax)) return false;
        if (bedrooms && p.bedrooms !== Number(bedrooms)) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = `${p.title || ''} ${p.public_location || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      // Proyección pública centralizada y restringida.
      const publicData = properties.map(toPublicProperty);

      return json({ properties: publicData, total: publicData.length });
    }

    // ---------------- POST: captura de leads ----------------
    if (req.method === 'POST') {
      const body = await readPublicJson(req);
      const full_name = publicText(body.full_name, 120, false);
      const normalizedEmail = publicText(body.email, 160, false).toLowerCase();
      const phone = publicText(body.phone, 25);
      const message = publicText(body.message, 1500);
      const source = publicText(body.source, 80) || 'web';
      const lead_type = publicText(body.lead_type, 80) || 'contacto';
      const submittedPropertyId = publicText(body.property_id, 100) || undefined;
      // WordPress-only cards currently send their commercial code in property_id.
      const commercialReference = /^A[1-9]\d{2,9}$/i.test(submittedPropertyId || '')
        ? submittedPropertyId.toUpperCase() : undefined;
      let property_id = commercialReference ? undefined : submittedPropertyId;
      const budget_min = optionalBudget(body.budget_min);
      const budget_max = optionalBudget(body.budget_max);
      if (budget_min !== undefined && budget_max !== undefined && budget_min > budget_max) {
        throw new PublicInputError('El presupuesto mínimo supera el máximo.');
      }
      if (body.preferred_areas != null && (!Array.isArray(body.preferred_areas) || body.preferred_areas.length > 10)) {
        throw new PublicInputError('Zonas inválidas.');
      }
      const preferred_areas = body.preferred_areas == null ? undefined :
        [...new Set(body.preferred_areas.map(area => publicText(area, 120, false)))];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new PublicInputError('Correo inválido.');
      }
      // The current website validates consent before forwarding but omits this field.
      // Reject an explicit refusal; requiring proof at this boundary needs a coordinated caller change.
      if (body.consent !== undefined && body.consent !== true) {
        throw new PublicInputError('Se requiere autorización para tratar los datos.');
      }
      const normalizedPhone = normalizePhone(phone);
      const svc = createClientFromRequest(req).asServiceRole;
      if (commercialReference) {
        const matches = await svc.entities.Property.filter(
          { custom_id: commercialReference, web_visible: true, status: 'available' }, '-created_date', 2
        );
        if (Array.isArray(matches) && matches.length === 1 &&
            matches[0].custom_id === commercialReference && matches[0].web_visible === true &&
            matches[0].status === 'available' && typeof matches[0].id === 'string') {
          property_id = matches[0].id;
        }
        // If not uniquely confirmed in the CRM, retain ONLY the declared reference in notes.
        // Do not invent a Property relation, create a property, or assert its availability.
      } else if (property_id) {
        await requirePublicProperty(svc.entities, property_id);
      }
      const now = new Date();
      const submittedDetails = 'Solicitud pública: identidad y datos pendientes de verificación por un asesor. Datos declarados: ' + JSON.stringify({
        full_name, email: normalizedEmail, phone: normalizedPhone,
        message, source, lead_type, property_id, preferred_areas, budget_min, budget_max,
        property_reference: commercialReference,
        property_reference_status: commercialReference && !property_id ? 'pending_verification' : undefined
      });

      // Asociar la solicitud sin tratar el correo declarado como prueba de identidad.
      const existing = await svc.entities.Client.filter({ email: normalizedEmail });
      let client;
      // Suppress identical sequential resubmissions for five minutes.
      // This is not atomic across concurrent requests and is not an abuse rate limit.
      if (existing?.length) {
        const recent = await svc.entities.Interaction.filter({ client_id: existing[0].id }, '-created_date', 20);
        const repeated = (recent || []).some(item => {
          const age = now.getTime() - Date.parse(item.date);
          return item.notes === submittedDetails + '\nRecepción web completada.' && age >= 0 && age < 5 * 60 * 1000;
        });
        if (repeated) return json({ success: true, message: 'Lead recibido. Te contactaremos pronto.' }, 201);
      }

      const clientData = {
        full_name,
        email: normalizedEmail,
        phone: normalizedPhone || undefined,
        whatsapp: normalizedPhone || undefined,
        source: source || 'web',
        status: 'potential',
        client_type: 'buyer',
      };

      if (existing && existing.length > 0) {
        // Solo lectura de la ficha existente; los cambios requieren verificación interna.
        client = existing[0];
      } else {
        client = await svc.entities.Client.create(clientData);
      }

      // Log de comunicación
      await svc.entities.CommunicationLog.create({
        client_id: client.id,
        communication_type: 'email',
        direction: 'inbound',
        message: submittedDetails,
        status: 'read',
        sent_at: now.toISOString(),
        ai_generated: false,
      });

      // Crear oportunidad si hay interés en una propiedad
      if (property_id) {
        await svc.entities.Opportunity.create({
          name: `Interés web - ${full_name}`,
          client_id: client.id,
          property_ids: [property_id],
          stage: 'nuevo',
          value: budget_max || 0,
          notes: submittedDetails,
        });
      }

      // This final record marks completion for identical sequential retries.
      // Earlier failures do not create a completion marker.
      await svc.entities.Interaction.create({
        client_id: client.id,
        property_id: property_id || undefined,
        interaction_type: normalizedPhone ? 'whatsapp' : 'email',
        date: now.toISOString(),
        notes: submittedDetails + '\nRecepción web completada.',
        outcome: 'follow_up_needed',
      });

      return json({
        success: true,
        message: 'Lead recibido. Te contactaremos pronto.',
      }, 201);
    }

    return json({ error: 'Método no permitido' }, 405);
  } catch (error) {
    if (error instanceof PublicInputError) return json({ error: error.message }, error.status);
    console.error('Error en publicApi:', error);
    return json({ error: 'Error interno del servidor' }, 500);
  }
});
