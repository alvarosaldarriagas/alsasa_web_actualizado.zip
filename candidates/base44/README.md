# Base44 signed receiver — complete inactive replacement files

The two standalone files in `generated/` are prepared replacements for
`base44/functions/publicApi/entry.ts` and `base44/functions/captureChatLead/entry.ts`.
**They have not been installed. Editing the live files publishes them immediately.**

`build.mjs` preserves the existing publicApi GET implementation, public projection and
OPTIONS behavior, removes the old capture branch, and bundles the signed receiver with
its complete commercial flow. The chat replacement contains no legacy handler.
The source and output SHA-256 values are in `generated/manifest.json`; check the current
live source against those hashes before applying. Do not overwrite a changed live file.

The pinned SDK imports remain 0.8.40 for publicApi and 0.8.25 for captureChatLead.
The receiver uses the gateway's per-request `Base44-Service-Authorization` credential,
requires the exact app ID and pins the SDK API origin to `https://base44.app`. Neither
browser Authorization nor a request API-origin header can choose the write destination.
No permanent service token needs to be copied or stored manually. The actual gateway
headers must still be verified in a controlled hosted pilot.

## Configuration

Populate the names in `receiver-env.example.json` through Base44's secret/configuration
manager. All values are read server-side. Nothing is generated during application startup.

- Keep `ALSASA_CAPTURE_ENABLED=false` until the coordinated pilot is ready.
- Scope and policy must match the database gate and the website signing policy.
- The pilot window is explicit, finite, and at most 24 hours. Runtime does not silently
  extend an expired window or reset exhausted budgets.
- Signing and identity keys are separate random 32-byte values encoded as 64 lowercase
  hex digits. The identity key is shared across both channels within the CRM scope.
- `ALSASA_CAPTURE_KEYRING_JSON` contains `activeId` and `entries`, where each entry has
  `id` and its private 64-hex-digit `key`. Retain all older keys needed by stored requests.
  Key material must differ from the signing and identity keys and between entries.
- Admission and execution URLs use verified TLS, the same pooled Neon host/database,
  and exactly `alsasa_capture_admit` / `alsasa_capture_exec`. Owner credentials are rejected.
  The website's `alsasa_web_ingress` role is separate and cannot access payloads.

The new SQL migration creates NOLOGIN roles and a key-ID inventory function; it does not
activate a gate or provision permanent passwords. On every valid signed admission, the
adapter acquires the gate lock, checks all historical key IDs and calls the capture
function **in the same transaction**. Missing/corrupt inventory, an absent key or an
uncertain COMMIT blocks admission. The execution role still reads encrypted requests
through the existing least-privilege functions; it cannot invoke the inventory function.

## Verification performed

- 10 runtime/configuration tests.
- 10 cases executing both generated files in Deno 2.9.6, with exact SDK versions, a
  localhost-only fake catalog, and no external CRM permissions. This found and fixed
  a PostgreSQL CommonJS import incompatibility. Public GET/OPTIONS still work while
  capture is paused; unsigned, altered and alternate-method writes are rejected.
- 7 scenarios with actual SQL on the isolated Neon child branch: historical key
  discovery, absent-key blocking, complete-keyring admission, transactional locking,
  scope/role isolation and corrupted inventory. Gates/logins closed afterward.

Deno dependency imports were mapped to the locally installed exact npm versions because
this environment refused Deno's direct registry connection. The generated files retain
normal pinned `npm:` imports for Base44. Hosted module resolution and gateway behavior
are not claimed verified by the local run. The checked-in sources are JavaScript bundled
into `.ts` entry files with `@ts-nocheck`; these were executed, not statically type-certified.

Rebuild with `npm ci --prefix candidates/base44/tooling` and
`node candidates/base44/build.mjs`; run the packaged-entry checks with
`node candidates/base44/run-deno-tests.mjs`. Tool dependencies are isolated from the web app.
`runtime/` is the previously reviewed receiver dependency graph, copied without functional
changes; `source/` holds the input entrypoints, not an additional live endpoint.

## Activation still blocked

The Vercel project query still returns `INVALID_ARGUMENT`. The current tools do not
expose Base44 secret provisioning. No permanent credentials were created, and neither
live entrypoint was replaced. First populate secure configuration for a controlled
preview, verify the real gateway, widget and disposable CRM delivery, then coordinate
both deployments. Missing configuration closes capture; there is no unsigned fallback.

Other CRM writers have separate authorization paths. See `docs/receiver-cutover-status.md`.
