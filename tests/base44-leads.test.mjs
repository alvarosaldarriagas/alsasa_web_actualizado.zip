import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { validateLead, submitLeadToBase44 } from '../lib/base44-leads.js';
import { verifyEnvelope } from '../lib/guard-protocol.mjs';
import { CAPTURE_ROUTES } from '../lib/capture-contract.mjs';

const lead = { full_name: 'Prueba local', email: 'test@example.invalid', phone: '3000000000', consent: true };
const context = { kind: 'form', subject: 'a'.repeat(64), operation: '806c3f81-8d64-4f9c-82a8-b948094f32ab' };
const key = randomBytes(32), env = { ALSASA_CAPTURE_SIGNING_KEY: key.toString('hex'), ALSASA_CAPTURE_POLICY: 'test-only' };
const receipt = { success: true, delivered: true, code: 'delivered', operation: context.operation };
test('only explicit boolean consent is accepted', () => {
  for (const consent of [false, undefined, 'false', 'true', 1]) assert.ok(validateLead({ ...lead, consent }).error);
  assert.equal(validateLead(lead).lead.consent, true);
});
test('sender signs exact validated bytes and binds channel, operation and policy', async () => {
  let calls = 0;
  const result = await submitLeadToBase44(lead, context, { env, fetcher: async (url, init) => {
    calls++;
    assert.equal(url, 'https://alsasa-crm-9f762688.base44.app/functions/publicApi');
    assert.equal(init.redirect, 'error'); assert.ok(init.signal);
    const envelope = JSON.parse(init.headers['x-alsasa-envelope']);
    assert.equal(envelope.operation, context.operation); assert.equal(envelope.policy, env.ALSASA_CAPTURE_POLICY);
    assert.ok(verifyEnvelope(key, envelope, init.body, CAPTURE_ROUTES.form, Date.now()));
    assert.equal(JSON.parse(init.body).consent, true);
    return Response.json(receipt, { status: 201 });
  } });
  assert.equal(result.success, true); assert.equal(calls, 1);
});
for (const [name, status, data] of [
  ['legacy success', 200, { success: true }], ['reservation', 202, { ...receipt, delivered: false }],
  ['wrong operation', 201, { ...receipt, operation: 'different' }], ['missing delivery', 201, { success: true }],
  ['false success', 201, { ...receipt, success: 'true' }], ['wrong code', 201, { ...receipt, code: 'reserved' }],
]) test(name + ' is not confirmed delivery', async () => {
  assert.equal((await submitLeadToBase44(lead, context, { env, fetcher: async () => Response.json(data, { status }) })).success, false);
});
test('invalid consent, configuration or context produces no CRM request', async () => {
  let calls = 0; const fetcher = async () => { calls++; throw Error('must not execute'); };
  for (const ctx of [undefined, { ...context, kind: 'unknown' }, { ...context, subject: '127.0.0.1' }, { ...context, operation: 'not-a-uuid' }]) {
    assert.equal((await submitLeadToBase44(lead, ctx, { env, fetcher })).success, false);
  }
  assert.equal((await submitLeadToBase44({ ...lead, consent: false }, context, { env, fetcher })).success, false);
  assert.equal((await submitLeadToBase44(lead, context, { env: {}, fetcher })).success, false);
  assert.equal(calls, 0);
});
test('lost CRM response does not trigger retry', async () => {
  let calls = 0;
  await assert.rejects(submitLeadToBase44(lead, context, { env, fetcher: async () => { calls++; throw Error('lost'); } }));
  assert.equal(calls, 1);
});
test('chat uses its own schema and signed route', async () => {
  const result = await submitLeadToBase44({ ...lead, messages: [{ role: 'user', content: 'Información' }], property_id: 'A1166' }, { ...context, kind: 'chat' }, {
    env, fetcher: async (url, init) => {
      assert.ok(url.endsWith('/captureChatLead'));
      const envelope = JSON.parse(init.headers['x-alsasa-envelope']);
      assert.ok(verifyEnvelope(key, envelope, init.body, CAPTURE_ROUTES.chat, Date.now()));
      const body = JSON.parse(init.body); assert.equal(body.name, lead.full_name); assert.deepEqual(body.qualification.property_ids, ['A1166']);
      return Response.json(receipt, { status: 201 });
    },
  });
  assert.equal(result.success, true);
});
