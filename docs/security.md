# Security invariants

These rules are part of the Mandy's architecture and must survive feature growth.

1. **Tenant identity comes from the authenticated server session.** A route may accept resource ids, but it must never authorize access from a browser-supplied `organizationId`.
2. **Every business table is tenant-scoped.** Tenant records carry `organization_id`, are indexed with it and are protected by PostgreSQL RLS.
3. **Tenant database access is transactional.** The API sets `app.organization_id` using `set_config(..., true)` so the value is transaction-local.
4. **RLS is defense in depth, not a substitute for application authorization.** Permissions are checked before domain actions and RLS protects against accidental cross-tenant queries.
5. **No secrets in the browser.** Database credentials, service-role keys, payment secrets and AI provider keys are server-only.
6. **PWA caches are privacy-safe.** Auth, APIs, customer data, reservations and private documents are never cached by the service worker in V0.1.
7. **Logs are redacted.** Authorization headers, cookies, tokens, passwords and API keys must not be written to application logs.
8. **Audit critical changes.** Access control, menu publishing, reservation state changes, payments, stock adjustments and future AI actions must generate audit records.
9. **Personal data is minimized.** Collect only operationally necessary data. Marketing consent is explicit and timestamped separately from service communications.
10. **Destructive and financial actions are idempotent.** Payment callbacks, order transitions and future offline synchronization require idempotency keys before release.
11. **Dependencies are continuously checked.** CI fails on high-severity dependency audit findings and Dependabot proposes updates.
12. **Production configuration fails closed.** Missing secrets, unknown origins and invalid tenant context must stop the request rather than fall back to permissive behavior.
