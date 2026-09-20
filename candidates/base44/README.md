# Signed capture routing candidate

This module is a tested dispatch boundary, not a deployed Base44 function. It accepts
a `createCommercialReceiver` instance from the existing reviewed candidate. Both route
aliases bind to the same logical signed destination. It never calls the old capture
handler when authentication, configuration or delivery fails.

At cutover, build the receiver with the pinned bounded SDK transport and the distinct
admission/execution roles and keyring. Connect the existing publicApi **read-only GET**
branch as `readPublic`, and dispatch every POST through this router. For captureChatLead,
no read delegate is needed. The old write branches must be removed, not left accessible
through a query parameter or alternate method. Validate the exact entry files in Base44
before installation: editing those files publishes them immediately.

Real entry files were read at Base44 commit `25154a180b741e01678bfafea54037a54c285a67`.
They use SDK 0.8.40 (publicApi) and 0.8.25 (captureChatLead). They were not edited.
The fixture receiver dependency graph was copied from the same app during this session
without functional changes. The integration test proves the signed wire contract and real SQL
adapters, with simulated CRM effects. Runtime credential/bootstrap and live cutover
remain release work, described in `docs/security-turnstile-rollout.md`.
