# Hosted data isolation — 2026-09-28

The owner supplied the official Base44 testing link:
https://share--alsasa-crm-9f762688.base44.app

## Result

- Test catalog: HTTP 200, zero public properties; production baseline: 58.
- Hosted imports of pg 8.23.0 and Base44 SDK 0.8.40/0.8.25 succeeded.
- The testing gateway supplied X-Data-Env=dev and a dev-scoped service credential.
- Both bounded credential-only SDK transports read the same disposable marker
  in Test. Production queries returned zero matches before and after creation.
- One inactive IntegrationStatus marker, without personal or business data, was
  created and deleted in Test. Cleanup returned remaining=0.
- A temporary operator-key diagnostic function was added and then retired. Both
  origins now return HTTP 410 without SDK or entity access. Its private temporary
  operator key was removed. Existing capture/catalog and automation functions
  were not edited. No automation, email or LLM call was enabled.

The evidence is in `hosted-isolation-evidence-2026-09-28.json`. This is a data
isolation and hosted dependency result, not full lead delivery.

## Draft changes

The website now requires ALSASA_CAPTURE_DATA_ENV and fixes the capture destination
to the testing origin for dev, or the original live origin for prod. Vercel Preview
cannot select prod; a Production deployment cannot select dev. Local/development
execution is restricted to dev.

The receiver requires an explicit matching environment before SQL admission and
CRM transport. Missing/unknown context and crossed gateway header/credential
claims fail closed. Credential decoding never replaces authentication by Base44.

Verification: 80 Node tests, 12 bundled Deno checks, Next.js build passed.
No permanent credentials or activation flags were provisioned. Generated receiver
files remain inactive; the PR stays draft and unmerged.

## Remaining work

Provision a scoped, finite pilot with separate keys and durable quotas through
secure settings. Native Base44 branches share secrets: keep production capture
entrypoints unchanged while installing and exercising the test receiver.
Run real server-side Turnstile, hosted Neon admission and exactly one signed
synthetic lead; require a matching delivered receipt before coordinating cutover.

The work browser is unavailable in the current execution environment. MCP access
to Base44/GitHub works; these connectors expose no secure runtime-secret
provisioning action. The account's post-diagnostic credit delta has not been read.

References:
- https://docs.base44.com/documentation/managing-app-data/testing-your-data
- https://docs.base44.com/Building-your-app/working-with-branches
