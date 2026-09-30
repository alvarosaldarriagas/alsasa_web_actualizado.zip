import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Load the dependency-free client without changing the application's module mode.
const source = await readFile(new URL('../lib/base44-api.js', import.meta.url), 'utf8');
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const property = { id: 'crm-id', custom_id: 'A1149', status: 'available', price: 265000000,
  images: ['https://base44.app/photo.png'], listing_type: 'venta', description: '<script>x</script>' };
function response(t, body, status = 200) {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.ok(url.startsWith('https://alsasa-crm-9f762688.base44.app/functions/publicApi'));
    return new Response(JSON.stringify(body), { status });
  });
}
test('catalog keeps CRM price/photos and excludes retired, contracted and hidden stock', async t => {
  response(t, {properties: [property, {...property, custom_id:'A1116', status:'off_market'},
    {...property, custom_id:'A1166',status:'under_contract'}, {...property,web_visible:false}]});
  const rows = await api.getBase44Properties();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price, '265.000.000');
  assert.deepEqual(rows[0].gallery, property.images);
  assert.ok(!rows[0].content.includes('<script>'));
});
test('empty public inventory is valid', async t => {
  response(t, {properties: []}); assert.deepEqual(await api.getBase44Properties(), []);
});
test('malformed upstream data throws rather than publishing an empty catalog', async t => {
  response(t, {error:'unavailable'}); await assert.rejects(api.getBase44Properties());
});
test('upstream outage throws without a WordPress fallback', async t => {
  response(t, {}, 503); await assert.rejects(api.getBase44Properties(), /503/);
});
test('missing property returns null', async t => {
  response(t, {}, 404); assert.equal(await api.getBase44PropertyById('A1167'), null);
});
test('retired property detail is not published even if upstream returns it', async t => {
  response(t, {property:{...property,status:'off_market'}});
  assert.equal(await api.getBase44PropertyById('A1116'), null);
});
test('renta is displayed as Arriendo and old code format is accepted', async t => {
  response(t, {property:{...property,listing_type:'renta'}});
  assert.equal((await api.getBase44PropertyById('ID: A1149')).action,'Arriendo');
  assert.equal(api.normalizePropertyCode('ID%3A%20A1149'),'A1149');
});
test('catalog entry points have no WordPress network or bridge fallback', async () => {
  const entry = await readFile(new URL('../lib/wp-api.js', import.meta.url), 'utf8');
  assert.doesNotMatch(entry, /admin\.alsasa\.co|wordpress-bridge|fetch\(/);
});
