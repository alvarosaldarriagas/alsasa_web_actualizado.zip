import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

function publicMessages(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 30) {
    throw new PublicInputError('Historial inválido o demasiado largo.');
  }
  let total = 0;
  return value.map(message => {
    if (!message || typeof message !== 'object' || Array.isArray(message) ||
        !['user', 'bot', 'assistant'].includes(message.role)) {
      throw new PublicInputError('Mensaje inválido.');
    }
    const content = publicText(message.content, 2000, false);
    total += content.length;
    if (total > 30000) throw new PublicInputError('Historial demasiado largo.');
    return { role: message.role, content };
  });
}

const ALLOWED_INTENTS = ['buy', 'rent', 'sell', 'landlord', 'invest', 'valuation', 'human', 'information', 'other'];

function normalizeIntent(value) {
  return ALLOWED_INTENTS.includes(value) ? value : 'information';
}

function clientTypeFor(intent) {
  if (intent === 'rent') return 'tenant';
  if (intent === 'sell' || intent === 'valuation') return 'seller';
  if (intent === 'landlord') return 'landlord';
  if (intent === 'buy' || intent === 'invest') return 'buyer';
  return 'all';
}

function conversationIntent(intent) {
  return ['buy', 'rent', 'information'].includes(intent) ? intent : 'other';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await readPublicJson(req);
    const name = publicText(body.name, 120, false);
    const email = publicText(body.email, 160, false).toLowerCase();
    const phone = publicText(body.phone, 25);
    const consent = body.consent === true;
    const qualification = body.qualification ?? {};
    if (typeof qualification !== 'object' || Array.isArray(qualification)) {
      throw new PublicInputError('Calificación inválida.');
    }
    const intent = normalizeIntent(publicText(qualification.intent, 30));
    const stringList = (value, maxItems, maxLength) => {
      if (value === undefined || value === null) return [];
      if (!Array.isArray(value) || value.length > maxItems) {
        throw new PublicInputError('Lista inválida o demasiado larga.');
      }
      return [...new Set(value.map(item => publicText(item, maxLength, false)))];
    };
    const propertyIds = stringList(qualification.property_ids, 10, 100);
    const preferredAreas = stringList(qualification.preferred_areas, 10, 120);
    const numberValue = (value, max) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (!['number', 'string'].includes(typeof value) ||
          (typeof value === 'string' && !value.trim())) {
        throw new PublicInputError('Número inválido.');
      }
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || number > max) {
        throw new PublicInputError('Número fuera del rango permitido.');
      }
      return number;
    };
    const leadScore = numberValue(qualification.lead_score, 100) ?? 60;
    const budgetMin = numberValue(qualification.budget_min, Number.MAX_SAFE_INTEGER);
    const budgetMax = numberValue(qualification.budget_max, Number.MAX_SAFE_INTEGER);
    if (budgetMin !== undefined && budgetMax !== undefined && budgetMin > budgetMax) {
      throw new PublicInputError('El presupuesto mínimo supera el máximo.');
    }
    const budgetRange = publicText(qualification.budget_range, 200);
    const urgency = publicText(qualification.urgency, 120) || 'no especificada';
    // Validate the full request BEFORE any CRM read or write.
    const messages = publicMessages(body.messages);

    if (!consent) {
      return Response.json({ error: 'Se requiere autorización para tratar los datos.' }, { status: 400 });
    }
    if (!name || name.length > 120 || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length > 25) {
      return Response.json({ error: 'Nombre y correo válido son obligatorios.' }, { status: 400 });
    }

    // Fingerprint validated values only. Do not persist a second copy of the conversation.
    // This detects completed sequential retries, not concurrent requests or abuse.
    const fingerprintData = JSON.stringify({
      name, email, phone, intent, leadScore, budgetMin, budgetMax,
      budgetRange, urgency, propertyIds, preferredAreas, messages
    });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintData));
    const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const completionMarker = '\nRecepción bot completada v1: ' + fingerprint;
    const receipt = () => Response.json({
      success: true,
      message: 'Solicitud recibida. Un asesor verificará los datos.'
    });
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole.entities;
    const now = new Date().toISOString();
    // A public visitor may reference only public, currently available CRM properties.
    // Validate every ID before the first business write; mixed valid/private lists fail together.
    for (const id of propertyIds) {
      const matches = await svc.Property.filter({ id, web_visible: true, status: 'available' }, '-created_date', 2);
      if (!Array.isArray(matches) || matches.length !== 1 || matches[0].id !== id ||
          matches[0].web_visible !== true || matches[0].status !== 'available') {
        throw new PublicInputError('Referencia de propiedad no disponible.');
      }
    }
    const existing = await svc.Client.filter({ email });
    let client;

    if (existing?.length) {
      // Un correo declarado no demuestra identidad: nunca sobrescribir la ficha.
      client = existing[0];
      const recent = await svc.Interaction.filter({ client_id: client.id }, '-created_date', 20);
      if (!Array.isArray(recent)) throw new Error('Invalid interaction response');
      const nowMs = Date.parse(now);
      const completed = recent.some(interaction => {
        if (!interaction || interaction.client_id !== client.id ||
            typeof interaction.notes !== 'string' || !interaction.notes.endsWith(completionMarker)) return false;
        const age = nowMs - Date.parse(interaction.date);
        return Number.isFinite(age) && age >= 0 && age < 5 * 60 * 1000;
      });
      if (completed) return receipt();
    } else {
      client = await svc.Client.create({
        full_name: name,
        email,
        phone,
        whatsapp: phone,
        client_type: clientTypeFor(intent),
        status: 'potential',
        lead_score: leadScore,
        source: 'web',
        budget_min: budgetMin,
        budget_max: budgetMax,
        preferred_areas: preferredAreas,
        communication_preferences: phone ? ['whatsapp', 'email'] : ['email'],
        notes: `Lead capturado por el bot web de ALSASA. Identidad pendiente de verificación por un asesor. Intención: ${intent}.`
      });
    }

    const submittedDetails = 'Solicitud pública: identidad y datos pendientes de verificación por un asesor. Datos declarados: ' + JSON.stringify({
      name, email, phone, intent, preferred_areas: preferredAreas,
      budget_min: budgetMin, budget_max: budgetMax, lead_score: leadScore
    });

    const conversation = await svc.ChatConversation.create({
      visitor_name: name,
      visitor_email: email,
      visitor_phone: phone,
      messages,
      lead_score: leadScore,
      qualification: leadScore >= 75 ? 'hot' : leadScore >= 50 ? 'warm' : 'cold',
      intent: conversationIntent(intent),
      budget_range: budgetRange,
      preferred_areas: preferredAreas,
      status: 'converted',
      converted_to_client_id: client.id,
      last_interaction: now
    });

    const openOpportunities = await svc.Opportunity.filter({ client_id: client.id });
    const duplicate = (openOpportunities || []).find((opportunity) => {
      if (['ganado', 'perdido'].includes(opportunity.stage)) return false;
      const existingIds = opportunity.property_ids || [];
      if (!propertyIds.length && !existingIds.length) {
        return String(opportunity.notes || '').includes(`Intención bot: ${intent}`);
      }
      return propertyIds.some((id) => existingIds.includes(id));
    });

    let opportunity = duplicate;
    if (!duplicate) {
      opportunity = await svc.Opportunity.create({
        name: `Bot web — ${name} — ${intent}`,
        client_id: client.id,
        property_ids: propertyIds,
        stage: leadScore >= 75 ? 'calificado' : 'nuevo',
        value: budgetMax || budgetMin || 0,
        notes: `${submittedDetails}\nOrigen: bot web ALSASA. Intención bot: ${intent}. Urgencia: ${urgency}.`
      });
    }

    await svc.Interaction.create({
      client_id: client.id,
      property_id: propertyIds[0] || undefined,
      interaction_type: phone ? 'whatsapp' : 'email',
      date: now,
      // Last write: an earlier failure must not leave a completed receipt.
      notes: `${submittedDetails}\nIntención: ${intent}. Conversación: ${conversation.id}. Oportunidad: ${opportunity.id}.${completionMarker}`,
      outcome: 'follow_up_needed'
    });

    return receipt();
  } catch (error) {
    if (error instanceof PublicInputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Error en captureChatLead:', error);
    return Response.json({ error: 'No fue posible registrar la solicitud.' }, { status: 500 });
  }
});
