// Run after npm run build. Uses only fake configuration and invalid proofs.
// No request in this test can invoke Siteverify, OpenAI or CRM business handlers.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

async function checkServer(configured, port) {
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
    env: { PATH: process.env.PATH, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
      ...(configured ? { ALSASA_WEB_PROTECTION_ENABLED: 'true', ALSASA_TURNSTILE_HOSTNAME: 'alsasa.co', ALSASA_TURNSTILE_SECRET_KEY: 'fake-secret-for-negative-tests' } : {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    let ready = false;
    server.stdout.on('data', chunk => { if (chunk.toString().includes('Ready')) ready = true; });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
    for (let n = 0; n < 100 && !ready && server.exitCode === null; n++) await delay(100);
    assert.ok(ready, 'server must start');
    for (const path of ['/api/leads', '/api/chat']) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'POST', headers: { Origin: 'https://alsasa.co', 'Content-Type': path.endsWith('leads') ? 'application/x-www-form-urlencoded' : 'application/json' },
        body: path.endsWith('leads') ? 'full_name=Prueba' : '{}',
      });
      assert.equal(response.status, configured ? 403 : 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(typeof (await response.json()).error, 'string');
      console.log(`${path}: ${response.status}, configuración ${configured ? 'ficticia' : 'ausente'}`);
      if (configured) {
        const proof = { operation: '806c3f81-8d64-4f9c-82a8-b948094f32ab', proof: 'fake-proof-not-sent-to-cloudflare' };
        const blocked = await fetch(`http://127.0.0.1:${port}${path}`, {
          method: 'POST', headers: { Origin: 'https://alsasa.co', 'Content-Type': path.endsWith('leads') ? 'application/x-www-form-urlencoded' : 'application/json' },
          body: path.endsWith('leads') ? new URLSearchParams(proof) : JSON.stringify(proof),
        });
        assert.equal(blocked.status, 503, 'missing durable admission configuration must stop before Siteverify');
        assert.equal(blocked.headers.get('cache-control'), 'no-store');
        console.log(`${path}: 503, admisión persistente sin configurar`);
      }
    }
  } finally {
    server.kill('SIGTERM');
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
  }
}
await checkServer(false, 3110);
await checkServer(true, 3111);
