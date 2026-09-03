import { NextResponse } from "next/server";
import { submitLeadToBase44 } from "@/lib/base44-leads";

const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function isAllowedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "alsasa.co" ||
      hostname === "www.alsasa.co" ||
      /^alsasa-[a-z0-9-]+-alvaro-sanchezs-projects-85f656ac\.vercel\.app$/.test(hostname)
    );
  } catch {
    return false;
  }
}

function isRateLimited(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > MAX_ATTEMPTS;
}

export async function POST(request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta más tarde." }, { status: 429 });
  }

  try {
    const formData = await request.formData();

    // Campo señuelo: los visitantes no lo ven; los bots suelen completarlo.
    if (String(formData.get("website") || "").trim()) {
      return NextResponse.redirect(new URL("/gracias", request.url), 303);
    }

    const result = await submitLeadToBase44({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      message: formData.get("message"),
      source: formData.get("source"),
      lead_type: formData.get("lead_type"),
      property_id: formData.get("property_id"),
      consent: formData.get("consent") === "on",
    });

    const status = result.success ? "ok" : "error";
    return NextResponse.redirect(new URL(`/gracias?status=${status}`, request.url), 303);
  } catch (error) {
    console.error("Lead submission error:", error);
    return NextResponse.redirect(new URL("/gracias?status=error", request.url), 303);
  }
}
