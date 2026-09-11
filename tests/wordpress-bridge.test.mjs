import test from "node:test";
import assert from "node:assert/strict";
import { approvedPosts, propertyCode, mapWordPressPost, mediaGallery, mergePhotoGallery, mergeCatalog, mergeWordPressPrice } from "../lib/wordpress-bridge.mjs";

test("A1167 is a rental and constructed area takes precedence over other area", () => {
  const record = post("A1167");
  record.content.rendered += '<p>Área: 60 m2</p>';
  const mapped = mapWordPressPost(record);
  assert.equal(mapped.action, "Arriendo");
  assert.equal(mapped.area, "90");
  assert.equal(mapped.location, "El Carmelo, Sabaneta");
  const monteflor = mapWordPressPost(post("A1166"));
  assert.equal(monteflor.action, "Arriendo");
  assert.equal(monteflor.location, "Monteflor, Sabaneta");
  assert.equal(monteflor.beds, "3");
  assert.equal(monteflor.baths, "2");
});

test("A1149 price updates in catalog and description without importing private WordPress fields", () => {
  const base = {id:"A1149",price:"265.000.000",content:"Precio $265.000.000<br />Valor: $265.000.000",image:"old.jpg",location:"Public sector",base44Id:"original"};
  const wp = post("A1149");
  wp.content.rendered = '<p>ID A1149</p><p>Valor: $270.000.000</p><p>Ubicación: Private street</p>';
  assert.deepEqual(mergeWordPressPrice(base, wp), {...base,price:"270.000.000",content:"Precio $270.000.000<br />Valor: $270.000.000"});
  assert.equal(mergeCatalog([base], [wp])[0].price, "270.000.000");
  const ambiguous = {...wp,content:{rendered:wp.content.rendered+'<p>Valor: $280.000.000</p>'}};
  assert.equal(mergeWordPressPrice(base, ambiguous),base);
  assert.equal(mergeWordPressPrice(base, {...wp,status:"draft"}),base);
});

const post = (code = "A1165") => ({ id: 24943, status: "publish", title: { rendered: "Apartamento &amp; balcón" },
  content: { rendered: `<p>ID ${code}</p><ul><li>Valor: $ 650.000.000</li><li>Área Construida: 90 m2</li><li>Habitaciones:3</li><li>Baños: 2</li><li>Ubicación: Calle privada 123</li><li>Propietario: Persona privada</li></ul>` } });
const photo = (id, extra = {}) => ({ id, post: 24943, mime_type: "image/jpeg", source_url: `https://admin.alsasa.co/wp-content/uploads/2026/09/photo${id}.jpeg`, ...extra });

test("only unambiguous published approved codes enter the bridge", () => {
  assert.equal(propertyCode(post()), "A1165");
  assert.deepEqual(approvedPosts([post(), post(), post("A9999"), { ...post("A1163"), status: "draft" }]), []);
  assert.deepEqual(approvedPosts([post("A1163"), post("A1164")]).map(propertyCode), ["A1163", "A1164"]);
  assert.equal(propertyCode({ ...post(), content: { rendered: "Precio A1165 sin ID" } }), "");
});

test("public listing uses canonical code and supplied numeric fields without private labels", () => {
  const mapped = mapWordPressPost(post());
  assert.equal(mapped.id, "A1165");
  assert.equal(mapped.price, "650.000.000");
  assert.equal(mapped.area, "90");
  assert.equal(mapped.beds, "3");
  assert.equal(mapped.baths, "2");
  assert.equal(mapped.title, "Apartamento & balcón");
  assert.doesNotMatch(mapped.content, /Calle privada|Persona privada/);
  assert.equal(mapWordPressPost(post("A1149")), null);
  const missing = mapWordPressPost({ ...post(), content: { rendered: "ID A1165" } });
  assert.equal(missing.area, "Consultar");
  assert.equal(missing.price, "Consultar");
  assert.equal(missing.beds, "—");
});

test("HTML is escaped and galleries exclude HTML, SVG, foreign hosts and unrelated attachments", () => {
  const mapped = mapWordPressPost({ ...post(), content: { rendered: "<p>ID A1165</p><p>Entorno: &lt;img src=x onerror=alert(1)&gt;</p>" } });
  assert.doesNotMatch(mapped.content, /<img/);
  const media = [photo(1), photo(1), photo(2, { post: 999 }), photo(3, { mime_type: "text/html" }),
    photo(4, { source_url: "https://other.example/image.jpeg" }),
    photo(5, { source_url: "https://admin.alsasa.co/wp-content/uploads/x.svg" })];
  assert.deepEqual(mediaGallery(post(), media), [photo(1).source_url]);
});

test("A1149 only adds photos: price, content, identity, location and existing images are preserved", () => {
  const base = { id: "A1149", base44Id: "business-id", price: "265.000.000", content: "Original", location: "San Antonio de Prado", image: "old.jpg", gallery: ["old.jpg"] };
  const updated = mergePhotoGallery(base, ["new.jpg", "old.jpg"]);
  assert.deepEqual(updated, { ...base, gallery: ["old.jpg", "new.jpg"] });
  assert.equal(mergePhotoGallery(base, []), base);
  const other = { ...base, id: "A1162" };
  assert.equal(mergePhotoGallery(other, ["new.jpg"]), other);
});

test("catalog preserves every baseline entry, avoids duplicates, and survives unavailable WordPress", () => {
  const base = Array.from({ length: 58 }, (_, n) => ({ id: `A${1000 + n}`, price: "original" }));
  assert.deepEqual(mergeCatalog(base, []), base);
  const merged = mergeCatalog(base, [post()]);
  assert.equal(merged.length, 59);
  assert.deepEqual(merged.slice(1), base);
  assert.equal(mergeCatalog([...base, { id: "A1165", source: "base44" }], [post()]).length, 59);
});
