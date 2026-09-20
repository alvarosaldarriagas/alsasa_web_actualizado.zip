import { protectRequest, guardError } from '@/lib/turnstile-guard.mjs';
import { NextResponse } from "next/server";
import { submitLeadToBase44, validateLead } from "@/lib/base44-leads";

export const runtime = 'nodejs';

export async function POST(request) {
  return protectRequest(request, 'form', async (body, context) => {
    if (String(body.website || '').trim()) return guardError(400, "Solicitud inválida.");
    const input = { ...body, consent: body.consent === 'on' };
    const validated = validateLead(input);
    if (validated.error) return guardError(400, validated.error);
    try {
      const result = await submitLeadToBase44(input, context);
      if (!result.success) return guardError(502, "No pudimos confirmar la recepción. Consulta por WhatsApp antes de reenviar.");
      return NextResponse.json({ success: true });
    } catch {
      return guardError(502, "No pudimos confirmar la recepción. Consulta por WhatsApp antes de reenviar.");
    }
  });
}
