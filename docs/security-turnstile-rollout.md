# Protected web capture — draft update, 2026-09-20

**NOT ACTIVE IN PRODUCTION. Do not merge or redeploy this draft yet.**
PR: https://github.com/alvarosaldarriagas/alsasa_web_actualizado.zip/pull/7
Previous reviewed head: c1cfa9d02fdc7a27ac2f504db12472b8e68905e0.

## Completed in this candidate

- Both public Next.js handlers consume a durable Neon admission before Siteverify or
  any business callback. The process-local Map counters have been removed.
- Admission uses the Vercel platform IP header only inside a Vercel runtime. IPs are
  normalized and HMAC-tagged with a separate server key before entering the database.
  No browser field chooses the IP, subject, policy, destination or limit.
- `consume_ingress` serializes admissions and checks a rolling per-subject cap, a
  rolling global cap per channel, a total cap per channel for the configured window,
  and a persistent operation UUID. Rotating IPs does not evade the global caps.
- Global caps default to zero; configuration missing, expired/disabled policy, database
  errors and uncertain commits cannot authorize an external request. Attempts consumed
  before failed challenge verification are not refunded or retried.
- The website signs exact validated CRM payload bytes with channel, destination,
  operation, policy and expiry. The form and chat use distinct fixed Base44 routes.
- Chat contact capture also requires the explicit checkbox from the browser. A model's
  function argument cannot by itself supply the required consent.
- Only HTTP 201 with `success: true`, `delivered: true`, `code: delivered` and the same
  operation is a confirmed receipt. Pending, legacy or mismatched receipts cannot
  display a successful registration. Redirects and automatic retries are disabled.
- `candidates/base44/capture-router.mjs` sends every POST to the signed receiver with
  no legacy fallback. It delegates public catalog GET separately. It is a candidate,
  **not an installed replacement for either live Base44 entry point**.

The signed receiver and complete commercial flow used in the integration test are
snapshots of the previously reviewed Base44 candidate, under `tests/fixtures/base44-security`.
They are not imported by Next.js or published into Base44 functions. The test connects
actual website modules to these receivers and actual transactional PostgreSQL adapters.

## Evidence and limits

- 62 local tests passed: 54 security/capture tests and 8 catalog regressions.
- Production build passed; six negative HTTP checks against that build passed, including
  both channels with syntactically valid proofs but missing durable-admission configuration.
- Base44 test checkpoint: `6aaf3b1044950291e22163f0`.
- 15 integration scenarios passed against real Neon in the new isolated branch
  `br-fragrant-frog-aun1tbvl`, project `green-recipe-32463242`, database `alsasa_guard_test`.
- Ten same-operation concurrent requests produced one verifier call and one commercial
  delivery. Ten different subjects consumed exactly the two remaining global slots.
- Form and chat completed encrypted admission and all required commercial steps;
  unsigned and modified requests were blocked before CRM effects; lost responses
  remained unconfirmed and the same operation could not repeat.
- The web database role could not read encrypted submissions, modify gates, call
  commercial admission, or use another role's scope.
- Cloudflare, OpenAI and CRM business effects were simulated. This does not verify
  real Turnstile keys, production SDK deployment, actual CRM writes or provider billing.
- The migration was applied only on that isolated child branch. The original technical
  branch and production were not migrated. All test gates and temporary logins were
  closed, temporary credentials removed, and the child endpoint confirmed `idle`.
- The first local SQL test could not resolve Neon DNS and made no connection; the
  successful SQL run used the established Base44 test runtime. Full evidence is in
  `security-neon-integration-evidence.json`.

Run local checks:

```sh
node --test tests/turnstile-guard.test.mjs tests/base44-leads.test.mjs tests/web-ingress.test.mjs tests/wordpress-bridge.test.mjs
npm run build
node tests/security-route-smoke.mjs
```

`tests/neon-web-integration.mjs` is a privileged, explicitly targeted migration/test
script, not a CI unit test. It pins the disposable branch host, expects the prior
technical schema, uses random test-only keys, and disables its scopes and logins in
`finally`. A repeated run needs a fresh unmigrated test branch and an explicit target
update; do not run it on a production URL. Never commit its temporary connection file.

## Configuration still required

| Location | Variable/configuration | Requirement |
| --- | --- | --- |
| Vercel | `ALSASA_TURNSTILE_SECRET_KEY` | Owner reports saved for Production; value never read or verified here |
| Vercel | `ALSASA_TURNSTILE_HOSTNAME` | Exact approved hostname; intended `alsasa.co` |
| Vercel | `ALSASA_WEB_PROTECTION_ENABLED` | Leave unset until cutover is ready |
| Vercel | `ALSASA_GUARD_DATABASE_URL` | TLS pooled Neon URL, role `alsasa_web_ingress`; runtime cannot use owner credentials |
| Vercel | `ALSASA_INGRESS_SCOPE` | Explicit ingress scope owned by the dedicated web role |
| Vercel | `ALSASA_INGRESS_SUBJECT_KEY` | Private 32-byte random key encoded as 64 lowercase hex digits |
| Vercel + Base44 receiver | `ALSASA_CAPTURE_SIGNING_KEY` | Same private 32-byte random signing key, distinct from subject/encryption/identity keys |
| Vercel + Base44 receiver | `ALSASA_CAPTURE_POLICY` | Same active commercial policy/window identifier |
| Neon | Gates/windows/ingress limits | Explicit finite window and per-subject/global/window quotas for both channels |
| Base44 | Receiver runtime | Pinned bounded SDK, service credentials, separate admission/execution pools, scope, identity key, encryption keyring and complete required-key inventory |

No new real keys or passwords were provisioned. Only test credentials were generated,
used and revoked. Never put secret values in `NEXT_PUBLIC_*` variables or the repository.
Public site key supplied by the owner: `0x4AAAAAAE9CuOqyU22WeN5E`.

## Concrete cutover work remaining

1. The complete Base44 replacements and atomic key inventory are now prepared in
   `candidates/base44/generated/` and tested locally/in isolated SQL. See
   `receiver-cutover-status.md`. Their secure configuration and hosted verification
   remain required before installation. Live direct routes are still unchanged.
2. Provision credentials and finite limits in an isolated preview, apply the migration
   there, and connect the web role plus separate receiver roles. The new ingress role
   must never receive access to customer payloads or commercial functions.
3. Verify the real widget/secret, actual Vercel IP boundary and pooled connection,
   production SDK/bootstrap, full browser lifecycle and real disposable CRM receipts.
   The earlier remote-browser localhost restriction still leaves visual testing pending.
4. Coordinate both deployments and enablement only after these checks. Deploying the
   website early with missing configuration pauses forms/chat; deploying the Base44
   signed-only receiver early breaks legacy submissions. Do not use an unguarded fallback.

The quotas bound admitted operations; they are not a monetary billing cap, an edge
DDoS control, or coverage of manual CRM/importer activity. Browser refresh can create a
new operation UUID; same-operation replay is blocked durably, while distinct operations
rely on the commercial identity/opportunity controls. Database attempts are retained for
the current finite pilot; retention and review/reconciliation procedures must be defined
before ongoing operation. Do not automatically free uncertain commercial locks.

References checked:
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://vercel.com/docs/headers/request-headers
