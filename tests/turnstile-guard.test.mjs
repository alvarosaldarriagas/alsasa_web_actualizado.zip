import test from 'node:test';
import assert from 'node:assert/strict';
import { protectRequest, readBoundedText, verifyTurnstile } from '../lib/turnstile-guard.mjs';

const operation = '806c3f81-8d64-4f9c-82a8-b948094f32ab';
const now = Date.parse('2026-09-19T12:00:00Z');
const env = { ALSASA_WEB_PROTECTION_ENABLED: 'true', ALSASA_TURNSTILE_HOSTNAME: 'alsasa.co', ALSASA_TURNSTILE_SECRET_KEY: 'test-only-fake-secret' };
const payload = { proof: 'fake-token', operation, messages: [{ role: 'user', content: 'Hola' }] };
const admitIngress = async () => ({ allowed: true, subject: 'a'.repeat(64) });
const verified = { success: true, hostname: 'alsasa.co', action: 'alsasa_chat', cdata: operation, challenge_ts: new Date(now).toISOString() };
function request(body = payload, headers = {}) {
  return new Request('https://alsasa.co/api/chat', { method: 'POST', headers: { origin: 'https://alsasa.co', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
async function invoke(req, options = {}, data = verified) {
  let verifyCalls = 0, businessCalls = 0, received;
  const response = await protectRequest(req, 'chat', async (body) => {
    businessCalls++; received = body;
    return Response.json({ reply: 'Respuesta de prueba' });
  }, { env, admitIngress, now: () => now, fetcher: async (url, init) => {
    verifyCalls++;
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    return Response.json(data);
  }, ...options });
  return { response, verifyCalls, businessCalls, received };
}

test('verified proof allows exactly one business call without propagating proof or secret', async () => {
  const result = await invoke(request());
  assert.equal(result.response.status, 200);
  assert.equal(result.businessCalls, 1);
  assert.equal(result.verifyCalls, 1);
  assert.deepEqual(result.received, { messages: payload.messages });
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
});
for (const [name, override, status] of [
  ['no activation', { ALSASA_WEB_PROTECTION_ENABLED: '' }, 503],
  ['no secret', { ALSASA_TURNSTILE_SECRET_KEY: '' }, 503],
  ['no hostname', { ALSASA_TURNSTILE_HOSTNAME: '' }, 503],
  ['wildcard hostname', { ALSASA_TURNSTILE_HOSTNAME: '*.vercel.app' }, 503],
]) test(name + ' blocks before external calls', async () => {
  const result = await invoke(request(), { env: { ...env, ...override } });
  assert.equal(result.response.status, status); assert.equal(result.businessCalls, 0); assert.equal(result.verifyCalls, 0);
});
for (const origin of ['', 'http://alsasa.co', 'https://alsasa.co.evil.test', 'https://alsasa.co:444', 'https://alsasa-preview.vercel.app', 'https://alsasa.co/']) {
  test('rejects noncanonical origin ' + origin, async () => {
    const result = await invoke(request(payload, { origin }));
    assert.equal(result.response.status, 403); assert.equal(result.verifyCalls, 0); assert.equal(result.businessCalls, 0);
  });
}
for (const [name, body] of [
  ['missing proof', { operation }], ['long proof', { ...payload, proof: 'x'.repeat(2049) }],
  ['invalid UUID', { ...payload, operation: 'invented' }], ['UUID array', { ...payload, operation: [operation] }], ['array payload', []], ['null payload', null],
]) test(name + ' rejected without provider calls', async () => {
  const result = await invoke(request(body));
  assert.equal(result.response.status, 403); assert.equal(result.verifyCalls, 0); assert.equal(result.businessCalls, 0);
});
for (const [name, changes] of [
  ['failure', { success: false }], ['truthy success', { success: 'true' }], ['wrong host', { hostname: 'evil.test' }],
  ['wrong action', { action: 'alsasa_form' }], ['wrong operation', { cdata: 'different' }],
  ['expired', { challenge_ts: new Date(now - 300000).toISOString() }],
  ['future', { challenge_ts: new Date(now + 60000).toISOString() }], ['no timestamp', { challenge_ts: null }],
]) test(name + ' does not reach business handler', async () => {
  const result = await invoke(request(), {}, { ...verified, ...changes });
  assert.equal(result.response.status, 403); assert.equal(result.businessCalls, 0); assert.equal(result.verifyCalls, 1);
});
test('network failure is not retried and cannot reach business handler', async () => {
  let calls = 0;
  const result = await invoke(request(), { fetcher: async () => { calls++; throw new Error('private provider details'); } });
  assert.equal(calls, 1); assert.equal(result.businessCalls, 0);
  assert.equal(result.response.status, 403);
  assert.ok(!(await result.response.text()).includes('private'));
});
test('oversized chunked request is rejected', async () => {
  const result = await invoke(request({ ...payload, messages: 'x'.repeat(50000) }));
  assert.equal(result.response.status, 400); assert.equal(result.verifyCalls, 0);
});
test('duplicate form parameters are rejected before verification', async () => {
  let calls = 0;
  const req = new Request('https://alsasa.co/api/leads', { method: 'POST', headers: { origin: 'https://alsasa.co', 'content-type': 'application/x-www-form-urlencoded' }, body: `operation=${operation}&proof=x&proof=y` });
  const res = await protectRequest(req, 'form', () => { calls++; }, { env, fetcher: () => { calls++; } });
  assert.equal(res.status, 400); assert.equal(calls, 0);
});
test('form proof uses a distinct Cloudflare action', async () => {
  const req = new Request('https://alsasa.co/api/leads', { method: 'POST', headers: { origin: 'https://alsasa.co', 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: new URLSearchParams({ operation, proof: 'fake', consent: 'on' }) });
  const res = await protectRequest(req, 'form', body => { assert.equal(body.consent, 'on'); return Response.json({ success: true }); }, { env, admitIngress, now: () => now, fetcher: async () => Response.json({ ...verified, action: 'alsasa_form' }) });
  assert.equal(res.status, 200);
});
test('bounded reader cancels overflow and stalled streams', async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(32)); }, cancel() { cancelled = true; } });
  await assert.rejects(readBoundedText(new Response(body), 8), /body-too-large/);
  assert.equal(cancelled, true);
  await assert.rejects(readBoundedText(new Response(new ReadableStream()), 8, 20), /body-timeout/);
});
test('Siteverify timeout aborts one request', async () => {
  let calls = 0;
  const accepted = await verifyTurnstile({ ...payload, kind: 'chat', hostname: 'alsasa.co', secret: 'fake', timeoutMs: 20, fetcher: async (_, { signal }) => {
    calls++;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  assert.equal(accepted, false); assert.equal(calls, 1);
});
for (const [name, response] of [
  ['provider 500', () => new Response('{}', { status: 500 })],
  ['non-JSON', () => new Response('not json', { headers: { 'content-type': 'text/html' } })],
  ['oversized response', () => Response.json({ ...verified, padding: 'x'.repeat(10000) })],
  ['malformed JSON', () => new Response('{', { headers: { 'content-type': 'application/json' } })],
]) test(name + ' fails closed', async () => {
  const result = await invoke(request(), { fetcher: async () => response() });
  assert.equal(result.response.status, 403); assert.equal(result.businessCalls, 0);
});
