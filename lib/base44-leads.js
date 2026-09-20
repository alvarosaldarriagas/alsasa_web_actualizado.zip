import { readBoundedText } from './turnstile-guard.mjs';
import { signEnvelope } from './guard-protocol.mjs';
import { secretKey } from './web-guard-runtime.mjs';
import { validateCapture } from './capture-validator.mjs';
import { CAPTURE_ROUTES, CAPTURE_ORIGIN } from './capture-contract.mjs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLead(input) {
  const fullName = String(input.full_name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").trim();
  const message = String(input.message || "").trim();

  if (input.consent !== true) return { error: "Debes autorizar el tratamiento de tus datos." };
  if (fullName.length < 2 || fullName.length > 120) return { error: "Nombre inválido." };
  if (!EMAIL_PATTERN.test(email) || email.length > 160) return { error: "Correo inválido." };
  if (phone && (phone.length < 7 || phone.length > 25)) return { error: "Teléfono inválido." };
  if (message.length > 1500) return { error: "El mensaje es demasiado largo." };

  return {
    lead: {
      full_name: fullName,
      consent: true,
      email,
      phone,
      message,
      source: String(input.source || "web").slice(0, 80),
      lead_type: String(input.lead_type || "contacto").slice(0, 80),
      property_id: input.property_id ? String(input.property_id).slice(0, 80) : undefined,
    },
  };
}

export async function submitLeadToBase44(input, context, { env = process.env, fetcher = fetch, now = Date.now } = {}) {
  const validated = validateLead(input);
  if (validated.error) return { success: false, error: validated.error };
  const binding = CAPTURE_ROUTES[context?.kind];
  if (!binding || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(context.operation || '')
      || !/^[a-f0-9]{64}$/.test(context.subject || '') || !/^[a-zA-Z0-9_-]{1,100}$/.test(env.ALSASA_CAPTURE_POLICY || '')) {
    return { success: false, error: 'Entrega protegida no configurada.' };
  }
  let key;
  try { key = secretKey(env.ALSASA_CAPTURE_SIGNING_KEY); }
  catch { return { success: false, error: 'Entrega protegida no configurada.' }; }
  const lead = validated.lead;
  const capture = context.kind === 'form' ? lead : {
    name: lead.full_name, email: lead.email, phone: lead.phone, consent: true,
    messages: input.messages || [],
    qualification: { intent: 'information', property_ids: lead.property_id ? [lead.property_id] : [] },
  };
  if (!validateCapture(context.kind, capture)) return { success: false, error: 'Solicitud inválida.' };
  const bytes = Buffer.from(JSON.stringify(capture));
  if (bytes.length > 16384) return { success: false, error: 'Solicitud demasiado grande.' };
  const envelope = signEnvelope(key, { ...binding, operation: context.operation, subject: context.subject,
    policy: env.ALSASA_CAPTURE_POLICY, expiresAt: now() + 60000 }, bytes);
  const response = await fetcher(`${CAPTURE_ORIGIN}/functions/${binding.route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json',
      'x-alsasa-envelope': JSON.stringify(envelope) },
    body: bytes, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  const payload = JSON.parse(await readBoundedText(response, 8192));
  // A reservation (202), or a generic legacy success, is not a delivery receipt.
  if (response.status !== 201 || payload?.success !== true || payload.delivered !== true
      || payload.code !== 'delivered' || payload.operation !== context.operation) {
    return { success: false, error: 'No pudimos confirmar la recepción de la solicitud.' };
  }
  return { success: true };
}
