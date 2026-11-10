import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../lib/base44-api.js', import.meta.url), 'utf8');
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const available = { id: '123', custom_id: 'A1000', status: 'available', title: 'Test' };
let calls;
function respond(payload, status = 200) {
  calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(payload), { status });
  };
}
test('details bypass persistent cache; deleted property becomes null immediately', async () => {
  respond({ property: available });
  assert.equal((await api.getBase44PropertyById('A1000')).id, 'A1000');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.next, undefined);
  respond({ error: 'Propiedad no encontrada' }, 404);
  assert.equal(await api.getBase44PropertyById('A1000'), null);
});
test('unavailable and hidden details stay excluded', async () => {
  for (const property of [{ ...available, status: 'rented' }, { ...available, web_visible: false }]) {
    respond({ property });
    assert.equal(await api.getBase44PropertyById('A1000'), null);
  }
});
test('catalog retains its five-minute cache and visibility filter', async () => {
  respond([available, { ...available, status: 'rented' }, { ...available, web_visible: false }]);
  assert.equal((await api.getBase44Properties()).length, 1);
  assert.deepEqual(calls[0].options.next, { revalidate: 300 });
  assert.equal(calls[0].options.cache, undefined);
});
test('upstream failures are not mistaken for absent properties', async () => {
  respond({ error: 'Unavailable' }, 503);
  await assert.rejects(api.getBase44PropertyById('A1000'), /503/);
});
