import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createCaptureRouter } from '../candidates/base44/capture-router.mjs';
import { createReceiverRuntime } from '../candidates/base44/receiver-runtime.mjs';
import { CAPTURE_ROUTES } from '../lib/capture-contract.mjs';
import { signEnvelope } from '../lib/guard-protocol.mjs';

const dispatchOrigin = 'https://base44-dispatcher-production.base44.workers.dev';
const dispatchPath = '/run/' + 'a'.repeat(32);
const dispatchUrl = dispatchOrigin + dispatchPath;

test('hosted catalog GET and OPTIONS preserve query and headers while capture is paused', async () => {
  const observed = [];
  const runtime = createReceiverRuntime({ kind: 'form', env: {}, readPublic: request => {
    observed.push({ method: request.method, url: request.url, app: request.headers.get('Base44-App-Id') });
    return new Response(null, { status: request.method === 'OPTIONS' ? 204 : 200 });
  } });
  for (const method of ['GET', 'OPTIONS']) {
    const response = await runtime.handle(new Request(dispatchUrl + '?action=detail&custom_id=A1166', {
      method, headers: { 'Base44-App-Id': CAPTURE_ROUTES.form.app },
    }));
    assert.equal(response.status, method === 'OPTIONS' ? 204 : 200);
  }
  assert.deepEqual(observed, ['GET', 'OPTIONS'].map(method => ({ method,
    url: dispatchOrigin + '/functions/publicApi?action=detail&custom_id=A1166', app: CAPTURE_ROUTES.form.app,
  })));
  assert.equal((await runtime.handle(new Request(dispatchUrl, { method: 'POST' }))).status, 503);
  assert.equal((await runtime.handle(new Request(dispatchUrl, { method: 'PUT' }))).status, 405);
  assert.equal(observed.length, 2);
  await runtime.close();
});

test('foreign, malformed and alternate gateway paths never invoke the catalog or receiver', async () => {
  let calls = 0;
  const router = createCaptureRouter({ kind: 'form', readPublic: () => { calls++; }, receiver: { handle: () => { calls++; } } });
  for (const url of [
    'https://example.invalid' + dispatchPath,
    'http://base44-dispatcher-production.base44.workers.dev' + dispatchPath,
    'https://base44-dispatcher-production.base44.workers.dev.example.invalid' + dispatchPath,
    dispatchOrigin + '/run/' + 'a'.repeat(31),
    dispatchOrigin + '/run/' + 'A'.repeat(32),
    dispatchUrl + '/extra',
    dispatchOrigin + '/functions/captureChatLead',
  ]) {
    for (const method of ['GET', 'POST']) assert.equal((await router(new Request(url, { method }))).status, 404);
  }
  assert.equal(calls, 0);
});

const signing = randomBytes(32);
const env = {
  ALSASA_CAPTURE_ENABLED: 'true', ALSASA_CAPTURE_DATA_ENV: 'prod', ALSASA_CAPTURE_SCOPE: 'routing_test', ALSASA_CAPTURE_POLICY: 'routing_test',
  ALSASA_CAPTURE_STARTS_AT: new Date(Date.now() - 60000).toISOString(), ALSASA_CAPTURE_ENDS_AT: new Date(Date.now() + 600000).toISOString(),
  ALSASA_CAPTURE_SIGNING_KEY: signing.toString('hex'), ALSASA_CAPTURE_IDENTITY_KEY: randomBytes(32).toString('hex'),
  ALSASA_CAPTURE_KEYRING_JSON: JSON.stringify({ activeId: 'routing_test', entries: [{ id: 'routing_test', key: randomBytes(32).toString('hex') }] }),
  ALSASA_CAPTURE_ADMISSION_DATABASE_URL: 'postgres://alsasa_capture_admit:synthetic@ep-test-pooler.us-east-1.aws.neon.tech/db',
  ALSASA_CAPTURE_EXECUTION_DATABASE_URL: 'postgres://alsasa_capture_exec:synthetic@ep-test-pooler.us-east-1.aws.neon.tech/db',
};
const token = claims => 'Bearer e30.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.synthetic_signature_only';

for (const kind of ['form', 'chat']) {
  test('hosted ' + kind + ' retains fixed route, app, environment and signature checks before admission', async () => {
    const calls = { sql: 0, crm: 0 };
    class Pool { on() {} async end() {} async connect() { calls.sql++; throw Error('Synthetic SQL stop'); } }
    const runtime = createReceiverRuntime({ kind, env, Pool,
      createAxiosClient: () => ({ interceptors: { request: { use() {} } } }),
      createEntitiesModule: () => new Proxy({}, { get: () => new Proxy({}, { get: () => () => { calls.crm++; throw Error('Unexpected CRM'); } }) }),
    });
    const body = Buffer.from(JSON.stringify(kind === 'form'
      ? { full_name: 'Persona ficticia', email: 'routing@example.invalid', consent: true }
      : { name: 'Persona ficticia', email: 'routing@example.invalid', consent: true, messages: [], qualification: { intent: 'information', property_ids: [] } }));
    const request = ({ boundKind = kind, bytes = body, key = signing, app = CAPTURE_ROUTES[kind].app, claims = {}, dataEnv } = {}) => new Request(dispatchUrl, {
      method: 'POST', headers: { 'content-type': 'application/json', 'Base44-App-Id': app, 'Base44-Service-Authorization': token(claims),
        ...(dataEnv ? { 'X-Data-Env': dataEnv } : {}),
        'x-alsasa-envelope': JSON.stringify(signEnvelope(key, { ...CAPTURE_ROUTES[boundKind], operation: randomUUID(), subject: 'a'.repeat(64),
          policy: 'routing_test', expiresAt: Date.now() + 30000 }, body)),
      }, body: bytes,
    });
    assert.equal((await runtime.handle(new Request(dispatchUrl, { method: 'POST' }))).status, 401);
    assert.equal((await runtime.handle(request({ app: 'another-app' }))).status, 503);
    assert.equal((await runtime.handle(request({ claims: { data_env: 'dev' }, dataEnv: 'dev' }))).status, 503);
    assert.equal((await runtime.handle(request({ key: randomBytes(32) }))).status, 401);
    assert.equal((await runtime.handle(request({ bytes: Buffer.from('{}') }))).status, 401);
    assert.equal((await runtime.handle(request({ boundKind: kind === 'form' ? 'chat' : 'form' }))).status, 401);
    assert.deepEqual(calls, { sql: 0, crm: 0 });
    // A valid envelope must reach admission once, with no CRM operation when SQL fails.
    assert.equal((await runtime.handle(request())).status, 503);
    assert.deepEqual(calls, { sql: 1, crm: 0 });
    await runtime.close();
  });
}
