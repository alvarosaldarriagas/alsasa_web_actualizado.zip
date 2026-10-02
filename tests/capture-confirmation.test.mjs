import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const leadSource = await readFile(new URL('../lib/base44-leads.js', import.meta.url), 'utf8');
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { submitLeadToBase44 } = await import(moduleUrl(leadSource));
const input = { full_name: 'Prueba local', email: 'test@example.invalid', phone: '3000000000', consent: true };

test('CRM requires explicit success and forwards consent without retrying', async (t) => {
  for (const [label, response, expected] of [
    ['acknowledgment', () => Response.json({ success: true }, { status: 201 }), true],
    ['empty success', () => Response.json({}), false],
    ['false success', () => Response.json({ success: false }), false],
    ['invalid JSON', () => new Response('<html>error</html>'), false],
    ['HTTP failure', () => Response.json({ success: true }, { status: 500 }), false],
  ]) {
    await t.test(label, async () => {
      let calls = 0;
      const mock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
        calls++;
        assert.equal(JSON.parse(options.body).consent, true);
        return response();
      });
      assert.equal((await submitLeadToBase44(input)).success, expected);
      assert.equal(calls, 1);
      mock.mock.restore();
    });
  }
});

test('truthy strings do not count as consent', async () => {
  assert.equal((await submitLeadToBase44({ ...input, consent: 'false' })).success, false);
});

test('ambiguous network failure is never retried', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('connection lost'); });
  await assert.rejects(submitLeadToBase44(input));
  assert.equal(calls, 1);
});

test('chat confirms a delayed capture without a second AI request', async (t) => {
  // Mock only external boundaries; execute the actual route and submission helper.
  let source = await readFile(new URL('../app/api/chat/route.js', import.meta.url), 'utf8');
  source = source.replace("import { NextResponse } from 'next/server';", 'const NextResponse = Response;')
    .replace("import { getProperties } from '@/lib/wp-api';", "const getProperties = async () => [{ id: 'A1149', base44Id: 'local-property', title: 'Apartamento', price: 265000000 }];")
    .replace("import { submitLeadToBase44 } from '@/lib/base44-leads';", `import { submitLeadToBase44 } from '${moduleUrl(leadSource)}';`);
  const { POST } = await import(moduleUrl(source));
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'local-test-only';
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
  let aiCalls = 0, crmCalls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('api.openai.com')) {
      aiCalls++;
      assert.equal(aiCalls, 1, 'confirmation must not require another AI call');
      return Response.json({ choices: [{ message: { tool_calls: [{ id: 'local-call', function: {
        name: 'capture_lead', arguments: JSON.stringify({ name: input.full_name, email: input.email, phone: input.phone, consent: true, property_reference: 'A1149', property_interest: 'Apartamento' })
      } }] } }] });
    }
    crmCalls++;
    await new Promise(resolve => setTimeout(resolve, 25000));
    return Response.json({ success: true }, { status: 201 });
  });
  const response = await POST(new Request('https://alsasa.co/api/chat', {
    method: 'POST', headers: { origin: 'https://alsasa.co', 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Prueba local autorizada' }] })
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.captured, true);
  assert.match(result.reply, /A1149/);
  assert.equal(aiCalls, 1);
  assert.equal(crmCalls, 1);
});
