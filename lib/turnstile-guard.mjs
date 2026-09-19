import { TURNSTILE_ACTIONS } from './turnstile-public.mjs';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function guardError(status, error) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

// Bound bytes while reading, including chunked requests and dishonest Content-Length.
export async function readBoundedText(message, maxBytes, timeoutMs = 5000) {
  if (!message.body) return '';
  const reader = message.body.getReader();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel().catch(() => {});
      reject(new Error('body-timeout'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      let bytes = 0;
      const chunks = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          void reader.cancel().catch(() => {});
          throw new Error('body-too-large');
        }
        chunks.push(value);
      }
      const buffer = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    })()]);
  } finally { clearTimeout(timer); }
}

export async function verifyTurnstile({ proof, operation, kind, hostname, secret, fetcher = fetch, now = Date.now, timeoutMs = 3000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(VERIFY_URL, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ secret, response: proof }).toString(),
    });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return false;
    const data = JSON.parse(await readBoundedText(response, 8192, timeoutMs));
    const timestamp = Date.parse(data?.challenge_ts);
    const age = now() - timestamp;
    return data?.success === true && data.hostname === hostname && data.action === TURNSTILE_ACTIONS[kind]
      && data.cdata === operation && Number.isFinite(age) && age >= -30000 && age < 300000;
  } catch { return false; }
  finally { clearTimeout(timer); }
}

// Both public routes use this wrapper: no business callback runs before Siteverify.
// Dependencies are injected only by unit tests; no request can select or bypass them.
export async function protectRequest(request, kind, handle, {
  env = process.env, fetcher = fetch, now = Date.now,
} = {}) {
  const secret = env.ALSASA_TURNSTILE_SECRET_KEY;
  const hostname = env.ALSASA_TURNSTILE_HOSTNAME;
  if (env.ALSASA_WEB_PROTECTION_ENABLED !== 'true' || !TURNSTILE_ACTIONS[kind]
      || typeof secret !== 'string' || secret.length < 16 || secret.length > 256
      || typeof hostname !== 'string' || !HOSTNAME.test(hostname)) {
    return guardError(503, 'El envío está temporalmente pausado. Puedes contactarnos por WhatsApp.');
  }
  if (request.method !== 'POST' || request.headers.get('origin') !== `https://${hostname}`) {
    return guardError(403, 'Origen no permitido.');
  }
  const expectedType = kind === 'form' ? 'application/x-www-form-urlencoded' : 'application/json';
  if (request.headers.get('content-type')?.split(';')[0].trim() !== expectedType) {
    return guardError(415, 'Formato no permitido.');
  }
  let body;
  try {
    const text = await readBoundedText(request, kind === 'form' ? 16384 : 49152);
    if (kind === 'form') {
      const params = new URLSearchParams(text);
      const keys = [...params.keys()];
      if (new Set(keys).size !== keys.length) return guardError(400, 'Solicitud inválida.');
      body = Object.fromEntries(params);
    } else body = JSON.parse(text);
  } catch { return guardError(400, 'Solicitud inválida o demasiado grande.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || typeof body.operation !== 'string' || !UUID.test(body.operation) || typeof body.proof !== 'string'
      || body.proof.length < 1 || body.proof.length > 2048) {
    return guardError(403, 'Completa la verificación de seguridad antes de enviar.');
  }
  if (!await verifyTurnstile({ proof: body.proof, operation: body.operation, kind, hostname, secret, fetcher, now })) {
    return guardError(403, 'No se pudo validar la verificación. Completa una nueva para continuar.');
  }
  const { proof, operation, ...payload } = body;
  const response = await handle(payload);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
