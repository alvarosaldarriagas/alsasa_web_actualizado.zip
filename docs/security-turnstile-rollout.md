# Turnstile web integration — draft, 2026-09-19

Status: NOT ACTIVE IN PRODUCTION. Do not merge or redeploy production yet.

This branch adds the browser and server verification layer to the existing website.
It is not the complete anti-abuse redesign, a shared rate limit, or a billing cap.
Base: main `af60569f695ec87980b130de0deb61d978e7a330`.

## Included

- Home and property forms and the chat render the same managed Turnstile widget,
  with distinct `alsasa_form` / `alsasa_chat` actions and a UUID v4 per challenge.
- `/api/leads` and `/api/chat` use a common server guard before their business callback.
  Exact HTTPS origin, bounded request/response reads, secret and explicit enablement
  are required. Siteverify must return boolean success, the expected hostname/action,
  the matching UUID and a timestamp less than five minutes old.
- Failed, expired, replayed (provider rejection), missing and malformed proofs never
  reach the business callback. No Siteverify retries or redirects.
- Browser proof invalidation on expiry/error, double-submit guards, and a fresh
  challenge after a submission. An uncertain delivery stops resubmission within
  the current page and offers WhatsApp. This is not durable idempotency across reloads.
- Turnstile requests are excluded from service-worker caches. Production builds
  regenerate the worker; generated worker changes are not part of this source PR.
- Explicit boolean consent is forwarded to Base44. A positive JSON `success: true`
  receipt is required; an HTTP 2xx alone is insufficient. This matches the inspected
  `base44/functions/publicApi/entry.ts` response schema. No real leads were submitted.
- Chat lead success uses a deterministic receipt, removing a second paid LLM call.
  Provider errors no longer expose internal exception text to the browser.

## Configuration and custody

The owner supplied public site key `0x4AAAAAAE9CuOqyU22WeN5E` and confirmed saving
`ALSASA_TURNSTILE_SECRET_KEY` as a Secret for Production in Vercel `alsasa-web`.
The secret value was never received, read, tested, or committed by the assistant.
The Vercel project query still failed after reconnection; no successful independent
inspection of the saved variable is claimed.

| Variable | Meaning | Current status |
| --- | --- | --- |
| `ALSASA_TURNSTILE_SECRET_KEY` | Server-only matching Cloudflare secret | Saved according to owner; unverified |
| `ALSASA_TURNSTILE_HOSTNAME` | One exact hostname, no scheme/path/wildcards | Not set by this work; intended canonical host `alsasa.co` |
| `ALSASA_WEB_PROTECTION_ENABLED` | Exact string `true` to open the guard | Leave unset until release gates below are completed |

Missing configuration returns 503 from both submission routes. There is no legacy
unguarded fallback. Deploying this draft without the complete configuration would
pause forms and chat; therefore do not merge it into main prematurely.
Only the configured hostname is accepted, including Origin and Siteverify output.
Preview must have an explicitly authorized hostname and matching environment secrets;
never allow all Vercel domains. Separate test CRM destination and credentials are
required before any positive preview submission. Do not use test keys in production.

## Verification

Run:

```sh
node --test tests/turnstile-guard.test.mjs tests/base44-leads.test.mjs tests/wordpress-bridge.test.mjs
npm run build
node tests/security-route-smoke.mjs
```

The tests mock all positive provider/CRM responses. Negative route smoke tests start
the actual production build with absent or fake configuration and submit no valid
tokens: they cannot reach Siteverify, OpenAI or the CRM. Tests are not evidence that
the owner's real Cloudflare keys or widget hostname settings are valid.

The cloud browser could not open the local preview (`ERR_BLOCKED_BY_CLIENT`). A full
visual/lifecycle test in an accessible preview and a real challenge are still pending.

## Remaining release gates

1. Connect the already prepared durable Neon admission/operation ledger from the
   Base44 candidate (`tests/security/form-integration-2026-09-19`) before Siteverify.
   The website's legacy Map counters remain best-effort per process only; bounded
   cleanup does not make them persistent. They do not protect Siteverify itself.
2. Integrate the signed commercial receiver and make direct public Base44 writes
   require the protected path. The inspected publicApi POST currently remains
   callable directly. Turnstile on Vercel alone does not close that route.
3. Enforce durable idempotency and global operation/spending limits, and validate the
   trusted client-IP boundary. Browser locks and LLM-generated consent arguments
   are not authoritative proofs of identity, authorization, or a billing ceiling.
4. Verify widget hostname/mode and the corresponding secret in an isolated preview.
   Exercise challenge completion, expiry/error, close/reopen chat, double submission,
   mobile layout, missing JS, invalid/replayed token, and uncertain delivery.
5. Run a controlled end-to-end test with disposable records, confirm acknowledgments
   and durable counters, then complete the production configuration and deployment.

The prior Base44 candidate and its test database gate remain inactive. This PR does
not publish Base44 resources, change Vercel variables, merge main, or enable Neon.

References:
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://vercel.com/docs/environment-variables/sensitive-environment-variables
