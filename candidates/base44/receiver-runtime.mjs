import { readReceiverConfig } from './runtime-config.mjs';
import { InventoryAdmissionLedger } from './inventory-ledger.mjs';
import { createCaptureRouter } from './capture-router.mjs';
import { createCommercialReceiver } from './runtime/form-integration-2026-09-19/commercial-receiver.mjs';
import { createBoundedEntities } from './runtime/form-integration-2026-09-19/bounded-sdk-transport.mjs';
import { CaptureLedger } from './runtime/inbox-2026-09-15/capture-ledger.mjs';
import { InboxKeyring } from './runtime/inbox-2026-09-15/keyring.mjs';
import { PostgresLedger } from './runtime/postgres-2026-09-15/postgres-ledger.mjs';
import { IdentityLedger } from './runtime/commercial-2026-09-19/identity-guard.mjs';
import { ClientBranchLedger } from './runtime/commercial-2026-09-19/client-branch-ledger.mjs';
import { CommercialLedger } from './runtime/commercial-2026-09-19/commercial-ledger.mjs';
const APP = '68b1e87f22e7326f9f762688';
const reply = (status, code) => Response.json({ success: false, code }, { status, headers: { 'Cache-Control': 'no-store' } });

export function createReceiverRuntime({ kind, env, Pool, createAxiosClient, createEntitiesModule, readPublic } = {}) {
  let ring; const pools = [];
  const closed = createCaptureRouter({ kind, readPublic });
  const close = async () => { ring?.destroy(); await Promise.allSettled(pools.map(p => p.end())); };
  try {
    const c = readReceiverConfig(env);
    if (!c || !['form', 'chat'].includes(kind)) return { handle: closed, close };
    const admission = new Pool(c.admission); pools.push(admission);
    const execution = new Pool(c.execution); pools.push(execution);
    for (const pool of pools) pool.on('error', () => {});
    ring = new InboxKeyring(c.ring);
    const signed = { async handle(request) {
      if (!request.headers.get('x-alsasa-envelope')) return reply(401, 'authorization_required');
      // Base44 injects this service credential per request. Never use browser Authorization,
      // persist the token, or let request headers choose the app/API destination.
      const authorization = request.headers.get('Base44-Service-Authorization');
      if (request.headers.get('Base44-App-Id') !== APP || !/^Bearer [^\s]{16,8192}$/.test(authorization || '')) return reply(503, 'platform_configuration_required');
      let transport, receiver;
      try {
        transport = createBoundedEntities({ createAxiosClient, createEntitiesModule, serverUrl: c.serverUrl,
          appId: APP, serviceToken: authorization.slice(7) });
        receiver = createCommercialReceiver({ enabled: true, kind, policy: c.policy,
          receiverConfig: { ...c.ring, key: c.signingKey, ledger: new InventoryAdmissionLedger(admission, c.scope, c.ring.entries.map(e => e.id)) },
          workerConfig: { signingKey: c.signingKey, identityKey: c.identityKey, keyring: ring, entities: transport.entities,
            inbox: new CaptureLedger(execution, c.scope), steps: new PostgresLedger(execution, c.scope),
            identity: new IdentityLedger(execution, c.scope), branch: new ClientBranchLedger(execution, c.scope), commercial: new CommercialLedger(execution, c.scope) },
        });
        // No provider call occurs unless the receiver validates the signature, stores the
        // encrypted request, and claims the authorized CRM step in the durable ledger.
        return await receiver.handle(request);
      } catch { return reply(503, 'temporarily_unavailable'); }
      finally { receiver?.close(); transport?.close(); }
    } };
    return { handle: createCaptureRouter({ kind, receiver: signed, readPublic }), close };
  } catch {
    void close(); return { handle: closed, close };
  }
}
