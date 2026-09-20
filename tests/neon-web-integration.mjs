// Explicit opt-in integration against a fixed isolated Neon branch. All CRM/Cloudflare effects are simulated.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { IngressRateLedger } from '../lib/ingress-rate-ledger.mjs';
import { admitWebIngress } from '../lib/web-guard-runtime.mjs';
import { protectRequest } from '../lib/turnstile-guard.mjs';
import { submitLeadToBase44 } from '../lib/base44-leads.js';
import { createCaptureRouter } from '../candidates/base44/capture-router.mjs';
import { createCommercialReceiver } from './fixtures/base44-security/form-integration-2026-09-19/commercial-receiver.mjs';
import { commercialPlan } from './fixtures/base44-security/commercial-2026-09-19/commercial-flow.mjs';
import { CaptureLedger } from './fixtures/base44-security/inbox-2026-09-15/capture-ledger.mjs';
import { InboxKeyring } from './fixtures/base44-security/inbox-2026-09-15/keyring.mjs';
import { PostgresLedger } from './fixtures/base44-security/postgres-2026-09-15/postgres-ledger.mjs';
import { IdentityLedger } from './fixtures/base44-security/commercial-2026-09-19/identity-guard.mjs';
import { ClientBranchLedger } from './fixtures/base44-security/commercial-2026-09-19/client-branch-ledger.mjs';
import { CommercialLedger } from './fixtures/base44-security/commercial-2026-09-19/commercial-ledger.mjs';

const connectionFile = '/tmp/alsasa-web-integration-connection.txt';
const url = new URL(readFileSync(connectionFile, 'utf8'));
assert.equal(url.hostname, 'ep-gentle-haze-ausjg9f8.c-10.us-east-1.aws.neon.tech');
assert.equal(url.pathname, '/alsasa_guard_test');
assert.equal(decodeURIComponent(url.username), 'alsasa_test_owner');
const config = { host: url.hostname, database: url.pathname.slice(1), ssl: { rejectUnauthorized: true, servername: url.hostname },
  connectionTimeoutMillis: 15000, statement_timeout: 10000, query_timeout: 15000, max: 12 };
const admin = new pg.Pool({ ...config, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password) });
const password = randomBytes(32).toString('hex');
const web = new pg.Pool({ ...config, user: 'alsasa_web_ingress', password });
const admission = new pg.Pool({ ...config, user: 'tg_admit', password });
const execution = new pg.Pool({ ...config, user: 'tg_exec', password });
const pools = [web, admission, execution];
const scope = 'web-' + randomUUID(), crmScope = 'crm-' + randomUUID();
const signingKey = randomBytes(32), identityKey = randomBytes(32), encryptionKey = randomBytes(32);
const env = { VERCEL: '1', ALSASA_INGRESS_SUBJECT_KEY: randomBytes(32).toString('hex'), ALSASA_CAPTURE_SIGNING_KEY: signingKey.toString('hex'),
  ALSASA_CAPTURE_POLICY: 'test-window', ALSASA_WEB_PROTECTION_ENABLED: 'true', ALSASA_TURNSTILE_HOSTNAME: 'alsasa.co', ALSASA_TURNSTILE_SECRET_KEY: 'simulated-provider-only' };
const rateLedger = new IngressRateLedger(web, scope), results = [], calls = [], receivers = [];
const keyring = new InboxKeyring({ activeId: 'test', entries: [{ id: 'test', key: encryptionKey }], requiredKeyIds: ['test'], signingKey });
const data = Object.fromEntries(['Client', 'Property', 'CommunicationLog', 'Opportunity', 'Interaction', 'ChatConversation'].map(name => [name, []]));
data.Property.push({ id: 'test-property', custom_id: 'A1166', web_visible: true, status: 'available' });
let loseCommunication = false, siteverifyCalls = 0;
const entities = Object.fromEntries(Object.keys(data).map(entity => [entity, {
  async filter(query, sort, limit, skip, fields) {
    calls.push({ entity, method: 'filter' });
    return data[entity].filter(row => Object.entries(query).every(([k, v]) => row[k] === v)).slice(0, limit)
      .map(row => Object.fromEntries(fields.filter(k => row[k] !== undefined).map(k => [k, structuredClone(row[k])])));
  },
  async create(body) {
    calls.push({ entity, method: 'create' });
    const row = { ...structuredClone(body), id: entity + '-' + randomUUID() }; data[entity].push(row);
    if (loseCommunication && entity === 'CommunicationLog') throw Error('Simulated lost CRM response');
    return structuredClone(row);
  },
}]));
const count = entity => calls.filter(c => c.entity === entity && c.method === 'create').length;
const check = async (name, fn) => { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); };
const rawAttempt = (subject = 'a'.repeat(64), kind = 'form', operation = randomUUID()) => rateLedger.consume({ subject, kind, operation });
async function limits(cap, global, total, kind = 'form') {
  await admin.query('UPDATE alsasa_guard_v1.ingress_limits SET cap=$3,global_cap=$4,window_cap=$5 WHERE scope=$1 AND kind=$2', [scope, kind, cap, global, total]);
}
const router = {};
let migrationApplied = false, closed = false;
try {
  assert.equal((await admin.query('SELECT count(*) n FROM alsasa_guard_v1.gate WHERE enabled')).rows[0].n, '0');
  const migration = readFileSync(new URL('../migrations/20260920-ingress-global-limits.sql', import.meta.url), 'utf8');
  await admin.query(migration); migrationApplied = true;
  for (const role of ['alsasa_web_ingress', 'tg_admit', 'tg_exec']) await admin.query(`ALTER ROLE ${role} LOGIN PASSWORD '${password}'`);
  for (const [s, admit] of [[scope, 'alsasa_web_ingress'], [crmScope, 'tg_admit']]) {
    await admin.query("INSERT INTO alsasa_guard_v1.gate VALUES($1,true,'test-window',$2,'tg_exec')", [s, admit]);
    await admin.query("INSERT INTO alsasa_guard_v1.windows VALUES($1,'test-window',now()-interval '1 minute',now()+interval '30 minutes',1000)", [s]);
  }
  for (const kind of ['form', 'chat']) {
    await admin.query("INSERT INTO alsasa_guard_v1.ingress_limits(scope,window_id,kind,interval_seconds,cap,global_cap,window_cap) VALUES($1,'test-window',$2,60,2,0,0)", [scope, kind]);
    const channel = kind === 'form' ? 'web-contact' : 'chat-capture';
    await admin.query("INSERT INTO alsasa_guard_v1.channels VALUES($1,'test-window',$2,$3)", [crmScope, channel, JSON.stringify(commercialPlan(kind))]);
    await admin.query("INSERT INTO alsasa_guard_v1.buckets(scope,window_id,dimension,bucket,cap) VALUES($1,'test-window','channel',$2,1000)", [crmScope, channel]);
  }
  await admin.query("INSERT INTO alsasa_guard_v1.buckets(scope,window_id,dimension,bucket,cap) VALUES($1,'test-window','resource','base44_sdk_attempt',10000)", [crmScope]);
  await check('Missing global configuration fails closed', async () => assert.equal((await rawAttempt()).allowed, false));
  await limits(2, 4, 6);
  await check('A repeated operation is denied after reconnecting the adapter', async () => {
    const operation = randomUUID(); assert.equal((await rawAttempt('a'.repeat(64), 'form', operation)).allowed, true);
    assert.equal((await new IngressRateLedger(web, scope).consume({ subject: 'b'.repeat(64), kind: 'form', operation })).allowed, false);
  });
  await check('Per-subject rolling cap is shared by connections', async () => {
    assert.equal((await rawAttempt()).allowed, true); assert.equal((await rawAttempt()).allowed, false);
  });
  await check('Ten different IP subjects consume only two remaining global slots', async () => {
    const r = await Promise.all(Array.from({ length: 10 }, (_, n) => rawAttempt(createHash('sha256').update('ip-' + n).digest('hex'))));
    assert.equal(r.filter(x => x.allowed).length, 2);
  });
  await check('Window cap still stops requests after the rolling interval has elapsed', async () => {
    await admin.query("UPDATE alsasa_guard_v1.ingress_attempts SET created_at=now()-interval '2 minutes' WHERE scope=$1", [scope]);
    assert.equal((await rawAttempt('b'.repeat(64))).allowed, true); assert.equal((await rawAttempt('c'.repeat(64))).allowed, true);
    assert.equal((await rawAttempt('d'.repeat(64))).allowed, false);
  });
  await check('Channels have separate configured quotas and operation IDs remain unique', async () => {
    await limits(2, 4, 6, 'chat'); const operation = randomUUID();
    assert.equal((await rawAttempt('a'.repeat(64), 'chat', operation)).allowed, true);
    assert.equal((await rawAttempt('a'.repeat(64), 'form', operation)).allowed, false);
  });
  await check('Web role cannot read ciphertext, change gates, or call commercial admission', async () => {
    for (const sql of ['SELECT * FROM alsasa_guard_v1.inbox', 'UPDATE alsasa_guard_v1.gate SET enabled=true', "SELECT alsasa_guard_v1.operate('x','admit','{}')"]) {
      await assert.rejects(web.query(sql), e => e.code === '42501');
    }
  });
  await check('Web role cannot consume a scope owned by a different admission role', async () => {
    await assert.rejects(new IngressRateLedger(web, crmScope).consume({ subject: 'a'.repeat(64), kind: 'form', operation: randomUUID() }), e => e.code === '42501');
  });
  for (const kind of ['form', 'chat']) {
    await limits(100, 500, 1000, kind);
    const receiver = createCommercialReceiver({ enabled: true, kind,
      policy: { id: 'test-window', enabled: true, startsAt: Date.now() - 60000, endsAt: Date.now() + 1200000 },
      receiverConfig: { key: signingKey, ledger: new CaptureLedger(admission, crmScope), activeId: 'test', entries: [{ id: 'test', key: encryptionKey }], requiredKeyIds: ['test'] },
      workerConfig: { inbox: new CaptureLedger(execution, crmScope), steps: new PostgresLedger(execution, crmScope), identity: new IdentityLedger(execution, crmScope),
        branch: new ClientBranchLedger(execution, crmScope), commercial: new CommercialLedger(execution, crmScope), keyring, signingKey, identityKey, entities },
    });
    receivers.push(receiver);
    router[kind] = createCaptureRouter({ kind, receiver, readPublic: () => Response.json({ properties: [] }) });
  }
  const lead = email => ({ full_name: 'Persona Ficticia', email, phone: '3000000000', consent: true, property_id: 'A1166', messages: [{ role: 'user', content: 'Consulta ficticia' }] });
  async function flow(kind = 'form', email = 'test@example.invalid', operation = randomUUID(), changeRequest) {
    const input = lead(email);
    const request = new Request('https://alsasa.co/api/' + (kind === 'form' ? 'leads' : 'chat'), { method: 'POST',
      headers: { origin: 'https://alsasa.co', 'content-type': kind === 'form' ? 'application/x-www-form-urlencoded' : 'application/json', 'x-vercel-forwarded-for': '203.0.113.25' },
      body: kind === 'form' ? new URLSearchParams({ proof: 'fake', operation }) : JSON.stringify({ proof: 'fake', operation }),
    });
    return protectRequest(request, kind, async (_, context) => {
      const result = await submitLeadToBase44(input, context, { env, fetcher: async (url, init) => {
        const incoming = new Request(url, init); return router[kind](changeRequest ? await changeRequest(incoming) : incoming);
      } });
      return Response.json(result, { status: result.success ? 200 : 502 });
    }, { env, admitIngress: (r, params) => admitWebIngress(r, params, { ledger: rateLedger }), fetcher: async () => {
      siteverifyCalls++;
      return Response.json({ success: true, hostname: 'alsasa.co', action: kind === 'form' ? 'alsasa_form' : 'alsasa_chat', cdata: operation, challenge_ts: new Date().toISOString() });
    } });
  }
  await check('Form runs web admission, signed encrypted capture and full commercial receipt', async () => {
    assert.equal((await flow('form', 'form@example.invalid')).status, 200);
    assert.equal(count('Client'), 1); assert.equal(count('Opportunity'), 1); assert.equal(count('Interaction'), 1);
  });
  await check('Chat uses its own signed route and creates a conversation', async () => {
    assert.equal((await flow('chat', 'chat@example.invalid')).status, 200); assert.equal(count('ChatConversation'), 1);
  });
  await check('Concurrent replay reaches the verifier and commercial writes just once', async () => {
    const operation = randomUUID(), before = siteverifyCalls, writes = count('Interaction');
    const results = await Promise.all(Array.from({ length: 10 }, () => flow('form', 'race@example.invalid', operation)));
    assert.equal(results.filter(r => r.status === 200).length, 1); assert.equal(results.filter(r => r.status === 429).length, 9);
    assert.equal(siteverifyCalls - before, 1); assert.equal(count('Interaction') - writes, 1);
  });
  await check('Unsigned direct POST fails before any CRM call; catalog GET still delegates', async () => {
    const before = calls.length;
    for (const kind of ['form', 'chat']) {
      const path = kind === 'form' ? 'publicApi' : 'captureChatLead';
      const r = await router[kind](new Request('https://example.invalid/functions/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(lead('direct@example.invalid')) }));
      assert.equal(r.status, 401);
    }
    assert.equal(calls.length, before);
    assert.equal((await router.form(new Request('https://example.invalid/functions/publicApi'))).status, 200);
  });
  await check('Altered signed body fails before any CRM call', async () => {
    const before = calls.length;
    const r = await flow('form', 'tamper@example.invalid', randomUUID(), async request => {
      const body = await request.json(); body.email = 'changed@example.invalid';
      return new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(body) });
    });
    assert.equal(r.status, 502); assert.equal(calls.length, before);
  });
  await check('Lost CRM response remains unconfirmed and the same operation cannot retry', async () => {
    const operation = randomUUID(); loseCommunication = true;
    assert.equal((await flow('form', 'lost@example.invalid', operation)).status, 502);
    const before = calls.length; loseCommunication = false;
    assert.equal((await flow('form', 'lost@example.invalid', operation)).status, 429); assert.equal(calls.length, before);
  });
  await check('Disabled ingress gate stops before provider or CRM', async () => {
    await admin.query('UPDATE alsasa_guard_v1.gate SET enabled=false WHERE scope=$1', [scope]);
    const before = siteverifyCalls, writes = calls.length;
    assert.equal((await flow()).status, 429); assert.equal(siteverifyCalls, before); assert.equal(calls.length, writes);
  });
} finally {
  for (const receiver of receivers) receiver.close(); keyring.destroy();
  if (migrationApplied) {
    await admin.query('UPDATE alsasa_guard_v1.gate SET enabled=false WHERE scope=ANY($1::text[])', [[scope, crmScope]]);
    for (const role of ['alsasa_web_ingress', 'tg_admit', 'tg_exec']) await admin.query(`ALTER ROLE ${role} NOLOGIN PASSWORD NULL`);
    const open = (await admin.query('SELECT count(*) n FROM alsasa_guard_v1.gate WHERE enabled')).rows[0].n;
    const roles = (await admin.query("SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname=ANY($1::text[])", [['alsasa_web_ingress', 'tg_admit', 'tg_exec']])).rows;
    closed = open === '0' && roles.every(r => !r.rolcanlogin); assert.equal(closed, true);
  }
  await Promise.all(pools.map(pool => pool.end())); await admin.end();
  unlinkSync(connectionFile);
  writeFileSync(new URL('../docs/security-neon-integration-evidence.json', import.meta.url), JSON.stringify({
    date: new Date().toISOString(), project: 'green-recipe-32463242', branch: 'br-fragrant-frog-aun1tbvl', scope, crmScope,
    passed: results.length, tests: results, migrationApplied, testGatesAndLoginsClosed: closed,
    crm: 'simulated', cloudflare: 'simulated', productionChanged: false,
  }, null, 2) + '\n');
}
console.log(JSON.stringify({ passed: results.length, closed, realCRMCalls: 0 }));
