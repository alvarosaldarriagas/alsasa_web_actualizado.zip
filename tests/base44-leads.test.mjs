import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, submitLeadToBase44 } from '../lib/base44-leads.js';

const lead = { full_name: 'Prueba local', email: 'test@example.invalid', phone: '3000000000', consent: true };
test('only explicit boolean consent is accepted and forwarded', () => {
  for (const consent of [false, undefined, 'false', 'true', 1]) assert.ok(validateLead({ ...lead, consent }).error);
  assert.equal(validateLead(lead).lead.consent, true);
});
test('HTTP success without a positive CRM receipt is not treated as delivery', async t => {
  let response = {};
  t.mock.method(globalThis, 'fetch', async (_, init) => {
    assert.equal(JSON.parse(init.body).consent, true);
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal);
    return Response.json(response);
  });
  for (response of [{}, { success: false }, { success: 'true' }]) assert.equal((await submitLeadToBase44(lead)).success, false);
  response = { success: true };
  assert.equal((await submitLeadToBase44(lead)).success, true);
});
test('invalid lead causes no CRM request', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; });
  assert.equal((await submitLeadToBase44({ ...lead, consent: false })).success, false);
  assert.equal(calls, 0);
});
