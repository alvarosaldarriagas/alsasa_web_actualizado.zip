import { protectRequest, guardError } from '@/lib/turnstile-guard.mjs';
import { NextResponse } from "next/server";
import { submitLeadToBase44, validateLead } from "@/lib/base44-leads";

const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function isRateLimited(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  const now = Date.now();
  for (const [key, times] of attempts) {
    if (!times.length || now - times[times.length - 1] >= WINDOW_MS) attempts.delete(key);
  }
  if (!attempts.has(ip) && attempts.size >= 5000) return true;
  const recent = (attempts.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) return true;
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > MAX_ATTEMPTS;
}

export async function POST(request) {
  return protectRequest(request, 'form', async (body) => {
    if (isRateLimited(request)) return guardError(429, "Demasiados intentos. Intenta más tarde.");
    if (String(body.website || '').trim()) return guardError(400, "Solicitud inválida.");
    const input = { ...body, consent: body.consent === 'on' };
    const validated = validateLead(input);
    if (validated.error) return guardError(400, validated.error);
    try {
      const result = await submitLeadToBase44(input);
      if (!result.success) return guardError(502, "No pudimos confirmar la recepción. Consulta por WhatsApp antes de reenviar.");
      return NextResponse.json({ success: true });
    } catch {
      return guardError(502, "No pudimos confirmar la recepción. Consulta por WhatsApp antes de reenviar.");
    }
  });
}
