import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { IngressRateLedger } from './ingress-rate-ledger.mjs';

const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
export function secretKey(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw Error('Invalid key configuration');
  return Buffer.from(value, 'hex');
}
export function ingressSubject(request, key, env) {
  // Only trust this platform header inside Vercel. Never accept an IP from JSON,
  // X-Forwarded-For, CF-Connecting-IP, or a comma-separated user-supplied chain.
  if (env.VERCEL !== '1') throw Error('Untrusted deployment');
  let ip = request.headers.get('x-vercel-forwarded-for');
  const family = isIP(ip || '');
  if (!family) throw Error('Missing platform IP');
  if (family === 6) ip = new URL(`https://[${ip}]`).hostname;
  return createHmac('sha256', key).update(JSON.stringify(['alsasa-web-ingress-v1', ip])).digest('hex');
}

let cached;
async function runtimeLedger(env) {
  const scope = env.ALSASA_INGRESS_SCOPE;
  if (!id(scope)) throw Error('Missing ingress scope');
  const url = new URL(env.ALSASA_GUARD_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !/^ep-[a-z0-9-]+-pooler\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname)
      || decodeURIComponent(url.username) !== 'alsasa_web_ingress' || !url.password
      || !/^\/[a-zA-Z0-9_]+$/.test(url.pathname)) throw Error('Invalid database configuration');
  const key = `${scope}:${env.ALSASA_GUARD_DATABASE_URL}`;
  if (cached?.key === key) return cached.ledger;
  if (cached) throw Error('Database configuration changed; restart required');
  const [{ Pool }, { attachDatabasePool }] = await Promise.all([import('pg'), import('@vercel/functions')]);
  const pool = new Pool({
    host: url.hostname, port: Number(url.port || 5432), database: url.pathname.slice(1),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: true, servername: url.hostname },
    max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 5000,
    statement_timeout: 5000, query_timeout: 6000, application_name: 'alsasa-web-ingress',
  });
  // Never log connection errors: drivers can include connection configuration.
  pool.on('error', () => {});
  attachDatabasePool(pool);
  const ledger = new IngressRateLedger(pool, scope);
  cached = { key, ledger };
  return ledger;
}

export async function admitWebIngress(request, { kind, operation, env = process.env }, { ledger } = {}) {
  const subjectKey = secretKey(env.ALSASA_INGRESS_SUBJECT_KEY);
  const signingKey = secretKey(env.ALSASA_CAPTURE_SIGNING_KEY);
  if (subjectKey.equals(signingKey) || !id(env.ALSASA_CAPTURE_POLICY)) throw Error('Invalid capture configuration');
  const subject = ingressSubject(request, subjectKey, env);
  const result = await (ledger ?? await runtimeLedger(env)).consume({ subject, kind, operation });
  return { allowed: result?.allowed === true, subject };
}
