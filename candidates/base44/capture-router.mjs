// Candidate only. Install with the signed receiver at cutover; never keep a legacy POST fallback.
import { CAPTURE_ROUTES } from '../../lib/capture-contract.mjs';

export function createCaptureRouter({ kind, receiver, readPublic } = {}) {
  const binding = CAPTURE_ROUTES[kind];
  const reply = (status, code) => Response.json({ success: false, code }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  return async request => {
    if (!binding) return reply(503, 'unconfigured');
    const paths = [`/functions/${binding.route}`, `/api/apps/${binding.app}/functions/${binding.route}`];
    if (!paths.includes(new URL(request.url).pathname)) return reply(404, 'route_not_found');
    if (request.method === 'GET' && kind === 'form' && typeof readPublic === 'function') return readPublic(request);
    if (request.method !== 'POST') return reply(405, 'method_not_allowed');
    if (typeof receiver?.handle !== 'function') return reply(503, 'paused');
    try { return await receiver.handle(request); }
    catch { return reply(503, 'temporarily_unavailable'); }
  };
}
