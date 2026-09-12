// Temporary, explicitly scoped additions. Base44 remains the catalog baseline.
const ADDITIONS = {
  A1163: "La Floresta, Medellín",
  A1164: "Sopetrán, Antioquia",
  A1165: "Loma de San Julián, Medellín",
  A1166: "Monteflor, Sabaneta",
  A1167: "El Carmelo, Sabaneta",
};
const PHOTO_ONLY = "A1149";
// A1164's verified original owns the photos; WordPress also exposes a duplicate.
const CANONICAL_WORDPRESS_IDS = { A1164: 25004 };
const API = "https://admin.alsasa.co/wp-json/wp/v2";
const POST_QUERY = "estate_property?per_page=100&_embed=wp:featuredmedia&_fields=id,status,title,content,featured_media,_links,_embedded";

export function plainText(value = "") {
  return String(value)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(?:p|li|div|h[1-6])>|<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => {
      const code = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/g, (_, n) =>
      ({ nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[n])
    .split("\n").map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function propertyCode(post) {
  const matches = [...plainText(post.content?.rendered).matchAll(/^ID\s*:?\s*(A\d+)\s*$/gim)];
  return matches.length === 1 ? matches[0][1].toUpperCase() : "";
}

export function approvedPosts(posts) {
  const candidates = posts.filter(post => {
    const code = propertyCode(post);
    return post.status === "publish" &&
      (Object.hasOwn(ADDITIONS, code) || code === PHOTO_ONLY) &&
      (!Object.hasOwn(CANONICAL_WORDPRESS_IDS, code) || post.id === CANONICAL_WORDPRESS_IDS[code]);
  });
  // Ambiguous codes never choose a property by chance.
  return candidates.filter(post => candidates.filter(other => propertyCode(other) === propertyCode(post)).length === 1);
}

export function imageUrl(value) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return "";
    if (!["admin.alsasa.co", "alsasa.co", "www.alsasa.co"].includes(url.hostname)) return "";
    if (!/^\/wp-content\/uploads\/.+\.(?:jpe?g|png|webp|gif|avif)$/i.test(url.pathname)) return "";
    url.protocol = "https:";
    url.hostname = "admin.alsasa.co";
    return url.href;
  } catch { return ""; }
}

export function mediaGallery(post, media) {
  const featured = imageUrl(post._embedded?.["wp:featuredmedia"]?.[0]?.source_url);
  const attached = media.filter(item => item.post === post.id && /^image\//.test(item.mime_type || ""))
    .sort((a, b) => a.id - b.id).map(item => imageUrl(item.source_url)).filter(Boolean);
  return [...new Set([featured, ...attached].filter(Boolean))];
}

export function mapWordPressPost(post, gallery = []) {
  const code = propertyCode(post);
  if (!Object.hasOwn(ADDITIONS, code)) return null;
  const text = plainText(post.content?.rendered);
  const field = pattern => text.match(pattern)?.[1]?.trim();
  const amount = field(/^(?:Valor|Precio)\s*:\s*\$?\s*([\d.]+)\s*$/im);
  const price = amount ? new Intl.NumberFormat("es-CO").format(Number(amount.replaceAll(".", ""))) : "Consultar";
  const area = field(/^[ÁA]rea\s+Construida\s*:\s*([\d.,]+)\s*(?:m2|m²|mts?2?|metros)/im) || "Consultar";
  // Only public descriptive fields are rendered, never owner/contact/address labels.
  const description = text.split("\n").filter(line =>
    /^(?:Inmueble|Valor|Precio|[ÁA]rea(?:\s+Construida)?|Habitaciones|Baños|Parqueadero|Ascensores|Cuarto útil|Estrato|Balcón|Piso|Año construcción|Administración|Comodidades|Amenidades|Entorno)\s*:/i.test(line));
  return {
    id: code, customId: code, wordpressId: post.id, source: "wordpress",
    title: plainText(post.title?.rendered), link: `/propiedad/${code}`,
    image: gallery[0] || "", gallery, price, area,
    beds: field(/^Habitaciones\s*:\s*(\d+)\b/im) || "—",
    baths: field(/^Baños\s*:\s*(\d+)\b/im) || "—",
    location: ADDITIONS[code], action: ["A1166", "A1167"].includes(code) ? "Arriendo" : "Venta",
    content: [`ID ${code}`, `Ubicación: ${ADDITIONS[code]}`, ...description].map(escapeHtml).join("<br />"),
  };
}

export function mergePhotoGallery(property, gallery) {
  if (!property || property.id !== PHOTO_ONLY || !gallery.length) return property;
  const combined = [...new Set([property.image, ...(property.gallery || []), ...gallery].filter(Boolean))];
  return { ...property, image: property.image || combined[0] || "", gallery: combined };
}

// The owner authorized A1149's price to follow WordPress as well as its photos.
export function mergeWordPressPrice(property, post) {
  if (property?.id !== "A1149" || !post || post.status !== "publish" || propertyCode(post) !== "A1149") return property;
  const amounts = [...plainText(post.content?.rendered).matchAll(/^(?:Valor|Precio)\s*:\s*\$?\s*(\d{1,3}(?:\.\d{3})+|\d+)\s*$/gim)];
  if (amounts.length !== 1) return property;
  const amount = Number(amounts[0][1].replaceAll(".", ""));
  if (!Number.isSafeInteger(amount) || amount <= 0) return property;
  const price = new Intl.NumberFormat("es-CO").format(amount);
  // Preserve the existing public description, updating only its old price occurrences.
  const oldPrice = String(property.price || "");
  const content = /^\d{1,3}(?:\.\d{3})+$/.test(oldPrice)
    ? String(property.content || "").replace(new RegExp(`(?<![\\d.])${oldPrice.replaceAll(".", "\\.")}(?![\\d.])`, "g"), price)
    : property.content;
  return { ...property, price, content };
}

async function readJson(path) {
  const response = await fetch(`${API}/${path}`, {
    headers: { Accept: "application/json" }, next: { revalidate: 60 },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`WordPress respondió ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("Respuesta inesperada de WordPress");
  return { data, pages: Number(response.headers.get("x-wp-totalpages") || 1) };
}

export async function getBridgePosts() {
  try {
    const first = await readJson(POST_QUERY);
    const posts = [...first.data];
    for (let page = 2; page <= first.pages; page++) {
      posts.push(...(await readJson(`${POST_QUERY}&page=${page}`)).data);
    }
    return approvedPosts(posts);
  } catch (error) {
    console.error("WordPress bridge unavailable:", error.message);
    return [];
  }
}

export async function getBridgeGallery(post) {
  try {
    const query = `media?parent=${post.id}&per_page=100&_fields=id,post,mime_type,source_url`;
    const first = await readJson(query);
    const media = [...first.data];
    for (let page = 2; page <= first.pages; page++) {
      media.push(...(await readJson(`${query}&page=${page}`)).data);
    }
    return mediaGallery(post, media);
  } catch (error) {
    console.error("WordPress gallery unavailable:", error.message);
    return mediaGallery(post, []);
  }
}

export function mergeCatalog(base, posts) {
  const additions = posts.map(post => mapWordPressPost(post, mediaGallery(post, [])))
    .filter(property => property && !base.some(existing => existing.id === property.id));
  const pricePost = posts.find(post => propertyCode(post) === "A1149");
  return [...additions, ...base.map(property => mergeWordPressPrice(property, pricePost))];
}
