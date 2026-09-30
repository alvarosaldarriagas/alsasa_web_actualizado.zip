import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from './tooling/node_modules/esbuild/lib/main.js';
import { PILOT_CAPTURE_ROUTES } from '../../lib/capture-contract.mjs';
const root = new URL('./', import.meta.url), files = {};
mkdirSync(new URL('entries/', root), { recursive: true });
mkdirSync(new URL('generated/', root), { recursive: true });
for (const [kind, name] of Object.entries(PILOT_CAPTURE_ROUTES)) {
  const version = kind === 'form' ? '0.8.40' : '0.8.25';
  const entry = `import pg from 'npm:pg@8.23.0';
import { createAxiosClient } from 'npm:@base44/sdk@${version}/dist/utils/axios-client.js';
import { createEntitiesModule } from 'npm:@base44/sdk@${version}/dist/modules/entities.js';
import { createPilotRuntime } from '../pilot-runtime.mjs';
const receiver = createPilotRuntime({ kind: '${kind}', config: Deno.env.get('ALSASA_PILOT_CAPTURE_CONFIG'), Pool: pg.Pool, createAxiosClient, createEntitiesModule });
Deno.serve(request => receiver.handle(request));
`;
  writeFileSync(new URL('entries/' + name + '.ts', root), entry);
  await build({ entryPoints: [new URL('entries/' + name + '.ts', root).pathname], outfile: new URL('generated/' + name + '.ts', root).pathname,
    bundle: true, platform: 'node', format: 'esm', target: 'es2022', external: ['npm:*', 'node:*'],
    banner: { js: '// @ts-nocheck\n// ADDITIVE TEST DATA PILOT. Disabled without its private configuration.\nimport { Buffer } from "node:buffer";' }, legalComments: 'none' });
  files[name] = { kind, sdk: version, sha256: createHash('sha256').update(readFileSync(new URL('generated/' + name + '.ts', root))).digest('hex') };
}
writeFileSync(new URL('generated/pilot-manifest.json', root), JSON.stringify({ testDataOnly: true, configuration: 'ALSASA_PILOT_CAPTURE_CONFIG', files }, null, 2) + '\n');
console.log('Built two additive Test Data-only pilot receivers');
