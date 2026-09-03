const BASE44_PUBLIC_API =
  process.env.ALSASA_BASE44_API_URL ||
  process.env.NEXT_PUBLIC_ALSASA_API ||
  "https://alsasa-crm-9f762688.base44.app/functions/publicApi";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLead(input) {
  const fullName = String(input.full_name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").trim();
  const message = String(input.message || "").trim();

  if (!input.consent) return { error: "Debes autorizar el tratamiento de tus datos." };
  if (fullName.length < 2 || fullName.length > 120) return { error: "Nombre inválido." };
  if (!EMAIL_PATTERN.test(email) || email.length > 160) return { error: "Correo inválido." };
  if (phone && (phone.length < 7 || phone.length > 25)) return { error: "Teléfono inválido." };
  if (message.length > 1500) return { error: "El mensaje es demasiado largo." };

  return {
    lead: {
      full_name: fullName,
      email,
      phone,
      message,
      source: String(input.source || "web").slice(0, 80),
      lead_type: String(input.lead_type || "contacto").slice(0, 80),
      property_id: input.property_id ? String(input.property_id).slice(0, 80) : undefined,
    },
  };
}

export async function submitLeadToBase44(input) {
  const validated = validateLead(input);
  if (validated.error) return { success: false, error: validated.error };

  const response = await fetch(BASE44_PUBLIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(validated.lead),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      error: payload.error || "No pudimos registrar la solicitud.",
    };
  }

  return { success: true };
}
