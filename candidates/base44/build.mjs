import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { build } from './tooling/node_modules/esbuild/lib/main.js';
const root = new URL('./', import.meta.url);
mkdirSync(new URL('entries/', root), { recursive: true }); mkdirSync(new URL('generated/', root), { recursive: true });
const names = ['publicApi', 'captureChatLead'], manifest = { sourceCommit: '4dacaf500c176d7bb29963364d452ce1278a3efc', files: {} };
for (const name of names) {
  const source = readFileSync(new URL('source/' + name + '.entry.ts', root), 'utf8').trimEnd();
  const version = name === 'publicApi' ? '0.8.40' : '0.8.25';
  const imports = `import pg from 'npm:pg@8.23.0';\nconst { Pool } = pg;\nimport { createAxiosClient } from 'npm:@base44/sdk@${version}/dist/utils/axios-client.js';\nimport { createEntitiesModule } from 'npm:@base44/sdk@${version}/dist/modules/entities.js';\nimport { createReceiverRuntime } from '../receiver-runtime.mjs';\n`;
  let entry = imports;
  if (name === 'publicApi') {
    const begin = source.indexOf('Deno.serve(async (req) => {');
    const post = source.indexOf('    // ---------------- POST: captura de leads ----------------', begin);
    if (begin < 0 || post < 0 || (source.match(/Deno\.serve\(/g) || []).length !== 1) throw Error('Source boundary changed');
    entry += source.slice(0, begin);
    entry += source.slice(begin, post).replace('Deno.serve(async (req) => {', 'async function readPublic(req) {');
    entry += "    return json({ error: 'Método no permitido' }, 405);\n  } catch (error) {\n    if (error instanceof PublicInputError) return json({ error: error.message }, error.status);\n    return json({ error: 'Error interno del servidor' }, 500);\n  }\n}\n";
  }
  entry += `const receiver = createReceiverRuntime({ kind: '${name === 'publicApi' ? 'form' : 'chat'}', env: Object.fromEntries(['ALSASA_CAPTURE_ENABLED','ALSASA_CAPTURE_SCOPE','ALSASA_CAPTURE_POLICY','ALSASA_CAPTURE_STARTS_AT','ALSASA_CAPTURE_ENDS_AT','ALSASA_CAPTURE_SIGNING_KEY','ALSASA_CAPTURE_IDENTITY_KEY','ALSASA_CAPTURE_KEYRING_JSON','ALSASA_CAPTURE_ADMISSION_DATABASE_URL','ALSASA_CAPTURE_EXECUTION_DATABASE_URL'].map(name => [name, Deno.env.get(name)])), Pool, createAxiosClient, createEntitiesModule${name === 'publicApi' ? ', readPublic' : ''} });\n`;
  entry += 'Deno.serve(request => receiver.handle(request));\n';
  writeFileSync(new URL('entries/' + name + '.ts', root), entry);
  await build({ entryPoints: [new URL('entries/' + name + '.ts', root).pathname], outfile: new URL('generated/' + name + '.ts', root).pathname,
    bundle: true, platform: 'node', format: 'esm', target: 'es2022', external: ['npm:*', 'node:*'],
    banner: { js: '// @ts-nocheck\n// INACTIVE CUTOVER CANDIDATE. Installing in base44/functions publishes immediately.\nimport { Buffer } from "node:buffer";' }, legalComments: 'none' });
  const output = readFileSync(new URL('generated/' + name + '.ts', root), 'utf8');
  manifest.files[name] = { sdk: version, sourceSha256: createHash('sha256').update(source).digest('hex'), generatedSha256: createHash('sha256').update(output).digest('hex') };
}
writeFileSync(new URL('generated/manifest.json', root), JSON.stringify(manifest, null, 2) + '\n');
console.log('Built two standalone inactive receiver candidates');
