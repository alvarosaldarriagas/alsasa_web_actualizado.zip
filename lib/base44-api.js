const BASE44_PUBLIC_API =
  process.env.ALSASA_BASE44_API_URL ||
  process.env.NEXT_PUBLIC_ALSASA_API ||
  "https://alsasa-crm-9f762688.base44.app/functions/publicApi";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((image) =>
      typeof image === "string"
        ? image
        : image?.url || image?.src || image?.file_url || ""
    )
    .filter(Boolean);
}

function mapProperty(property) {
  const gallery = normalizeImages(property.images);
  const numericPrice = Number(property.price);
  const price = Number.isFinite(numericPrice)
    ? new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(numericPrice)
    : "Consultar";
  const listingType = String(property.listing_type || "").toLowerCase();
  const action = ["rent", "rental", "arriendo", "arrendar"].includes(listingType)
    ? "Arriendo"
    : ["sale", "venta", "sell"].includes(listingType)
      ? "Venta"
      : property.listing_type || "Consultar";

  return {
    id: property.id,
    customId: property.custom_id || "",
    title: property.title || "Propiedad ALSASA",
    link: `/propiedad/${property.id}`,
    image: gallery[0] || "",
    gallery,
    price,
    area: property.square_feet ?? "Consultar",
    beds: property.bedrooms ?? "—",
    baths: property.bathrooms ?? "—",
    location: property.public_location || "Medellín y área metropolitana",
    action,
    content:
      escapeHtml(property.description || "").replaceAll("\n", "<br />") ||
      "Solicita información detallada a un asesor de ALSASA.",
    source: "base44",
  };
}

async function request(path = "") {
  const response = await fetch(`${BASE44_PUBLIC_API}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error(`Base44 respondió ${response.status}`);
  return response.json();
}

export async function getBase44Properties() {
  const payload = await request();
  const records = Array.isArray(payload)
    ? payload
    : payload?.properties || payload?.data || payload?.items || [];
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Base44 no devolvió propiedades públicas");
  }
  return records.map(mapProperty);
}

export async function getBase44PropertyById(id) {
  const payload = await request(`?action=detail&id=${encodeURIComponent(id)}`);
  const record = payload?.property || payload?.data || payload;
  if (!record?.id) throw new Error("Base44 no devolvió la propiedad solicitada");
  return mapProperty(record);
}
