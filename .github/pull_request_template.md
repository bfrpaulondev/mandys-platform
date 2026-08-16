## What changed

<!-- Describe the product or engineering change. -->

## Tenant safety

- [ ] Tenant identity is derived from the authenticated server session.
- [ ] New tenant data includes `organization_id` and appropriate indexes/RLS.
- [ ] No cross-tenant query can be triggered with browser-supplied tenant input.

## Product quality

- [ ] User-facing copy covers `pt-PT`, `pt-BR`, `en` and `es` where applicable.
- [ ] PWA cache rules do not store private responses.
- [ ] Theme changes remain separate from business logic.
- [ ] New commercial capabilities use module/theme entitlements when applicable.

## Verification

- [ ] Lint
- [ ] Typecheck
- [ ] Tests
- [ ] Build
- [ ] Dependency audit
