import { InboxKeyring } from './runtime/inbox-2026-09-15/keyring.mjs';
const validId = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
const key = x => {
  if (typeof x !== 'string' || !/^[a-f0-9]{64}$/.test(x)) throw Error('Invalid receiver configuration');
  return Buffer.from(x, 'hex');
};
function database(raw, role) {
  const u = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(u.protocol) || !/^ep-[a-z0-9-]+-pooler\.[a-z0-9.-]+\.neon\.tech$/.test(u.hostname)
      || decodeURIComponent(u.username) !== role || !u.password || !/^\/[a-zA-Z0-9_]+$/.test(u.pathname)
      || u.port && u.port !== '5432') throw Error('Invalid receiver database');
  return { host: u.hostname, port: 5432, database: u.pathname.slice(1), user: role, password: decodeURIComponent(u.password),
    ssl: { rejectUnauthorized: true, servername: u.hostname }, max: 4, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000, statement_timeout: 5000, query_timeout: 6000 };
}
export function readReceiverConfig(env) {
  if (env.ALSASA_CAPTURE_ENABLED !== 'true') return null;
  const scope = env.ALSASA_CAPTURE_SCOPE, id = env.ALSASA_CAPTURE_POLICY;
  if (!validId(scope) || !validId(id)) throw Error('Invalid receiver policy');
  const startsAt = Date.parse(env.ALSASA_CAPTURE_STARTS_AT), endsAt = Date.parse(env.ALSASA_CAPTURE_ENDS_AT);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt || endsAt - startsAt > 86400000) throw Error('Invalid pilot window');
  const signingKey = key(env.ALSASA_CAPTURE_SIGNING_KEY), identityKey = key(env.ALSASA_CAPTURE_IDENTITY_KEY);
  if (signingKey.equals(identityKey)) throw Error('Key reuse');
  if (typeof env.ALSASA_CAPTURE_KEYRING_JSON !== 'string' || env.ALSASA_CAPTURE_KEYRING_JSON.length > 12000) throw Error('Invalid keyring');
  const configured = JSON.parse(env.ALSASA_CAPTURE_KEYRING_JSON);
  if (!Array.isArray(configured.entries)) throw Error('Invalid keyring');
  const entries = configured.entries.map(e => ({ id: e.id, key: key(e.key) }));
  if (entries.some(e => e.key.equals(identityKey))) throw Error('Key reuse');
  const ring = { activeId: configured.activeId, entries, requiredKeyIds: [], signingKey };
  new InboxKeyring(ring).destroy();
  const admission = database(env.ALSASA_CAPTURE_ADMISSION_DATABASE_URL, 'alsasa_capture_admit');
  const execution = database(env.ALSASA_CAPTURE_EXECUTION_DATABASE_URL, 'alsasa_capture_exec');
  if (admission.host !== execution.host || admission.database !== execution.database) throw Error('Database mismatch');
  // Fixed origin: request headers cannot redirect a service credential to another server.
  return { scope, policy: { id, enabled: true, startsAt, endsAt }, signingKey, identityKey, ring, admission, execution,
    serverUrl: 'https://base44.app' };
}
