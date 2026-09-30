import { CAPTURE_ROUTES, PILOT_CAPTURE_ROUTES } from '../../lib/capture-contract.mjs';
import { gatewayDataEnvironment } from './gateway-environment.mjs';
import { createReceiverRuntime } from './receiver-runtime.mjs';

const reply = (status, code) => Response.json({ success: false, code }, {
  status, headers: { 'Cache-Control': 'no-store' },
});

// Additive, Test Data-only listener. Configuration is a private platform secret,
// never a request field. Original entrypoints and production config are untouched.
export function createPilotRuntime({ kind, config, ...dependencies } = {}) {
  let runtime;
  const binding = CAPTURE_ROUTES[kind], route = PILOT_CAPTURE_ROUTES[kind];
  try {
    if (!binding || typeof config !== 'string' || config.length > 16000) throw Error('Paused');
    const env = JSON.parse(config);
    if (!env || typeof env !== 'object' || Array.isArray(env)
        || env.ALSASA_CAPTURE_DATA_ENV !== 'dev') throw Error('Test Data required');
    runtime = createReceiverRuntime({ ...dependencies, kind, env });
  } catch { /* No credential, network or request contents are logged. */ }
  return {
    async handle(request) {
      if (!runtime) return reply(503, 'pilot_paused');
      const url = new URL(request.url);
      const paths = [`/functions/${route}`, `/api/apps/${binding.app}/functions/${route}`];
      // Hosted Base44 dispatches the selected function at /run/<deployment-id>.
      // The entrypoint fixes kind; the app/environment and signed logical route
      // below still authorize every request before any SQL or CRM operation.
      const dispatched = url.origin === 'https://base44-dispatcher-production.base44.workers.dev'
        && /^\/run\/[a-f0-9]{32}$/.test(url.pathname);
      if (!paths.includes(url.pathname) && !dispatched) return reply(404, 'route_not_found');
      if (request.method !== 'POST') return reply(405, 'method_not_allowed');
      if (gatewayDataEnvironment(request.headers) !== 'dev') return reply(503, 'test_data_required');
      // Canonicalize only the verified fixed pilot alias. Preserve the body stream
      // and signed logical route; no field can choose a destination or bypass HMAC.
      url.pathname = `/functions/${binding.route}`;
      return runtime.handle(new Request(url, request));
    },
    async close() { await runtime?.close(); },
  };
}
