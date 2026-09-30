import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { admitWebIngress, ingressSubject } from '../lib/web-guard-runtime.mjs';
import { IngressRateLedger } from '../lib/ingress-rate-ledger.mjs';
import { protectRequest } from '../lib/turnstile-guard.mjs';

const key = randomBytes(32), signing = randomBytes(32), operation = '806c3f81-8d64-4f9c-82a8-b948094f32ab';
const env = { VERCEL: '1', ALSASA_INGRESS_SUBJECT_KEY: key.toString('hex'), ALSASA_CAPTURE_SIGNING_KEY: signing.toString('hex'), ALSASA_CAPTURE_POLICY: 'test' };
const req = headers => new Request('https://alsasa.co/api/chat', { headers });
test('only the platform IP is trusted and equivalent IPv6 addresses have the same subject', () => {
  const h = ip => req({ 'x-vercel-forwarded-for': ip, 'x-forwarded-for': '203.0.113.2' });
  assert.equal(ingressSubject(h('2001:0db8:0:0:0:0:0:1'), key, env), ingressSubject(h('2001:db8::1'), key, env));
  for (const ip of ['', 'bad', '1.2.3.4, 5.6.7.8']) assert.throws(() => ingressSubject(h(ip), key, env));
  assert.throws(() => ingressSubject(req({ 'x-forwarded-for': '203.0.113.2' }), key, env));
  assert.throws(() => ingressSubject(h('203.0.113.2'), key, {}));
});
test('the database receives a keyed subject and never the raw IP or extra request fields', async () => {
  let received;
  const result = await admitWebIngress(req({ 'x-vercel-forwarded-for': '203.0.113.2' }), { env, kind: 'chat', operation }, {
    ledger: { consume: async x => { received = x; return { allowed: true }; } },
  });
  assert.match(result.subject, /^[a-f0-9]{64}$/); assert.deepEqual(received, { subject: result.subject, kind: 'chat', operation });
  assert.ok(!JSON.stringify(received).includes('203.0.113.2'));
});
test('missing or reused keys cannot reach the database', async () => {
  let calls = 0;
  for (const change of [{ ALSASA_INGRESS_SUBJECT_KEY: '' }, { ALSASA_CAPTURE_SIGNING_KEY: key.toString('hex') }]) {
    await assert.rejects(admitWebIngress(req({ 'x-vercel-forwarded-for': '203.0.113.2' }), { env: { ...env, ...change }, kind: 'chat', operation }, { ledger: { consume() { calls++; } } }));
  }
  assert.equal(calls, 0);
});
for (const [name, result, status] of [
  ['exhausted global cap', { allowed: false }, 429], ['malformed allowance', { allowed: 'true' }, 429],
  ['unknown commit', new Error('lost COMMIT'), 503], ['missing subject', { allowed: true }, 503],
]) test(name + ' stops before Cloudflare or business calls', async () => {
  let calls = 0;
  const request = new Request('https://alsasa.co/api/chat', { method: 'POST', headers: { origin: 'https://alsasa.co', 'content-type': 'application/json' }, body: JSON.stringify({ proof: 'fake', operation }) });
  const response = await protectRequest(request, 'chat', () => { calls++; }, {
    env: { ALSASA_WEB_PROTECTION_ENABLED: 'true', ALSASA_TURNSTILE_HOSTNAME: 'alsasa.co', ALSASA_TURNSTILE_SECRET_KEY: 'fake-test-secret' },
    admitIngress: async () => { if (result instanceof Error) throw result; return result; }, fetcher: async () => { calls++; },
  });
  assert.equal(response.status, status); assert.equal(calls, 0);
});
test('lost commit destroys connection and never retries admission', async () => {
  const commands = []; let destroyed;
  const ledger = new IngressRateLedger({ connect: async () => ({
    query: async sql => { commands.push(sql); if (sql === 'COMMIT') throw Error('response lost'); return { rows: [{ result: { allowed: true } }] }; },
    release: x => { destroyed = x; },
  }) }, 'test');
  await assert.rejects(ledger.consume({ subject: 'a'.repeat(64), kind: 'chat', operation }));
  assert.equal(commands.filter(x => x.startsWith('SELECT')).length, 1); assert.equal(destroyed, true);
});
