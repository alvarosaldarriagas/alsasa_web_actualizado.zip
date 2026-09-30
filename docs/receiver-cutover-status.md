# Receiver cutover status — 2026-09-20

Prepared complete standalone replacements, not deployed:
- `candidates/base44/generated/publicApi.ts`
- `candidates/base44/generated/captureChatLead.ts`

New: trusted runtime configuration, request-scoped bounded SDK, distinct database roles,
and an atomic inventory check before encrypted admission. The migration is applied only
to isolated child branch `br-fragrant-frog-aun1tbvl`. No CRM records were changed.

Evidence: 10 runtime tests, 10 Deno entrypoint cases and 7 real SQL scenarios passed.
The Deno package-resolution limitation and required hosted verification are documented
in the candidate README. Test scopes and role logins are closed and the endpoint suspended.

## Related entrypoints inspected read-only

| Entrypoint | Observed authorization in code | Relation to this change |
| --- | --- | --- |
| publicApi POST | Existing public capture | Prepared signed-only replacement |
| captureChatLead | Existing public capture | Prepared signed-only replacement |
| makeLeadIngestor | Enable flag plus shared secret | Independent integration; not covered by website quota |
| googleSheetsWebhook | Enable flag plus shared secret | Independent integration; not covered by website quota |
| leadIngestor | JWT verification | Separate authenticated integration; not certified by this review |
| vercelWebhook | Shared secret, also accepted from query string | Legacy integration; resolve whether used before retiring or adapting it |
| whatsappImporter | Authenticated user plus account-specific restriction | Internal import workflow, outside public web capture |
| googleSheetsSync / leadScoring | Authenticated caller checks observed | Separate internal paths, unchanged |
| automationEngine / triggerAutomations | Caller/administrative checks and paused workflow logic observed | Unchanged by this candidate |

These are source observations, not checks of configured secret values or runtime traffic.
The candidate does not claim to protect every Base44 operation or cap total platform billing.

## Required configuration handoff

Base44 needs the ten names in `candidates/base44/receiver-env.example.json`; Vercel needs
the website variables documented in `security-turnstile-rollout.md`. Base44 supplies its
service credential through its gateway per request, so no extra permanent service token
is requested. Secrets should be entered directly in platform settings, never in chat.

Before applying either replacement, compare current source hashes to the manifest,
verify Neon roles/finite windows and complete key custody, and prepare both deployments.
The live web and live Base44 must cut over together. The real Turnstile challenge and
actual disposable CRM receipt still need a hosted test. Vercel connector access remains
blocked (`INVALID_ARGUMENT`); reconnecting was not repeated.
