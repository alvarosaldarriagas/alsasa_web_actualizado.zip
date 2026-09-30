# One-delivery hosted pilot — 2026-09-28

## Prepared result

Two additive functions, `alsasaPilotForm` and `alsasaPilotChat`, wrap the existing
signed receiver. They accept only their fixed path aliases and a gateway Test Data
credential/header pair. The exact body stream and signed logical route are retained.
Missing configuration closes the pilot; Production context cannot reach SQL or CRM.
Existing `publicApi` and `captureChatLead` are not replaced.

The web sender selects these fixed pilot endpoints only for `dev`; Production
continues to select the original fixed endpoints. Arbitrary request fields cannot
choose a destination. The sender still requires a matching HTTP 201 delivery receipt.

Verification: 88 Node tests, 22 packaged Deno checks, Next.js production build.

## Concrete bounded configuration

| Setting | Pilot value |
| --- | --- |
| Vercel project | `alsasa-web` |
| Vercel environment | Preview, only `security/turnstile-web-2026-09-19` |
| Base44 app | `68b1e87f22e7326f9f762688`, Test Data |
| Base44 secret | `ALSASA_PILOT_CAPTURE_CONFIG`, private JSON |
| Neon project / branch | `green-recipe-32463242` / `br-fragrant-frog-aun1tbvl` |
| Database | `alsasa_guard_test` |
| Runtime roles | `alsasa_web_ingress`, `alsasa_capture_admit`, `alsasa_capture_exec` |
| Lifetime | Two hours from preparation; passwords expire at the same time |
| Web attempts | At most 3 form attempts; 0 chat admissions |
| Delivered operations | At most 1 form operation |
| SDK reservation | At most 7 individual attempts; no automatic retry |
| Synthetic identity | Name explicitly marks a technical test; email uses `example.invalid`; no phone |

The web needs seven Preview variables: `ALSASA_WEB_PROTECTION_ENABLED`,
`ALSASA_CAPTURE_DATA_ENV`, `ALSASA_GUARD_DATABASE_URL`, `ALSASA_INGRESS_SCOPE`,
`ALSASA_INGRESS_SUBJECT_KEY`, `ALSASA_CAPTURE_SIGNING_KEY`, `ALSASA_CAPTURE_POLICY`.
The existing Turnstile secret and Preview hostname remain in their platform settings.

`scripts/prepare-hosted-pilot.mjs /tmp/alsasa-pilot-private-<unique suffix>` creates
random, separate keys/passwords, platform configuration and SQL in a private directory
(0700 directory, 0600 files). It performs **no network calls or database changes**.
Private output must never be committed, printed, sent in chat or attached to a PR.
Regenerate an expired preparation before installing it; never silently extend a run.

## Execution and closure

1. Store the prepared values directly in the two platform settings, scoped as above.
2. Execute the fixed-branch provisioning SQL through the authorized database connection.
   It requires every gate and the three role logins to be closed, adds new unique scopes,
   and leaves both new gates disabled. Owner credentials are never stored in either app.
3. Rebuild only the Preview deployment; check the real packaged pilot has no import error.
4. Open the two gates for the finite window. Submit one synthetic contact through the
   Preview browser with real Turnstile verification. Expect a matching delivered receipt;
   an unconfirmed response is a stop for inspection, not permission to retry.
5. Verify the Test records and absence of the unique synthetic identity in Production.
   Record SQL counters and the observed credit delta if available.
6. Close both gates, disable the three temporary logins and remove their passwords.
   Set the pilot's platform enable flags/configuration to disabled and retire pilot
   listeners after evidence collection. Retain keys while any encrypted test capture
   needs inspection. No production promotion or PR merge is part of this pilot.

The browser confirmation policy requires action-time confirmation before granting
new cross-service access through stored credentials and before an interactive CAPTCHA.
Code and offline configuration are prepared first. Production deployment remains a
separate coordinated step after the hosted receipt is verified.
