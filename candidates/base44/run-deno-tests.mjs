import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = new URL('../../', import.meta.url), packages = new URL('./tooling/node_modules/', import.meta.url);
const imports = {};
for (const [alias, version] of [['sdk-public', '0.8.40'], ['sdk-chat', '0.8.25']]) {
  const installed = JSON.parse(readFileSync(new URL(alias + '/package.json', packages), 'utf8')).version;
  if (installed !== version) throw Error('SDK version mismatch');
  for (const [suffix, path] of [['', 'dist/index.js'], ['/dist/utils/axios-client.js', 'dist/utils/axios-client.js'], ['/dist/modules/entities.js', 'dist/modules/entities.js']]) {
    imports['npm:@base44/sdk@' + version + suffix] = new URL(alias + '/' + path, packages).href;
  }
}
imports['npm:pg@8.23.0'] = new URL('pg/lib/index.js', packages).href;
const temp = mkdtempSync(join(tmpdir(), 'alsasa-deno-map-'));
try {
  const map = join(temp, 'imports.json'); writeFileSync(map, JSON.stringify({ imports }));
  const result = spawnSync(fileURLToPath(new URL('.bin/deno', packages)), ['run', '--no-config', '--no-prompt', '--node-modules-dir=manual', '--import-map=' + map,
    '--allow-read', '--allow-env', '--allow-net=127.0.0.1', 'tests/receiver-deno.mjs'], {
    cwd: fileURLToPath(root), env: { PATH: process.env.PATH, NODE_ENV: 'production' }, encoding: 'utf8', timeout: 40000,
  });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  if (result.status !== 0) throw Error('Deno receiver checks failed');
  const report = result.stdout.split('\n').find(line => line.startsWith('{"passed"'));
  writeFileSync(new URL('docs/receiver-deno-evidence.json', root), JSON.stringify(JSON.parse(report), null, 2) + '\n');
} finally { rmSync(temp, { recursive: true, force: true }); }
