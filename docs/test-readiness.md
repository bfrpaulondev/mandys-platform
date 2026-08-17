# Mandy's internal QA readiness

Status: **ready for internal QA / unpaid pilot once the current main release gate is green**.

This document separates product readiness from commercial-provider activation. Internal testing must not require live charging, real email delivery or production media credentials.

## Release baseline

The test-ready baseline requires all of the following on the same `main` commit:

- quality gate: lint, strict TypeScript, Supabase Edge validation, authorization guards, pricing guards, unit tests, production build and dependency audit;
- versioned Storefront + Backoffice live-readiness;
- critical Edge-runtime health monitor;
- Stripe and transactional-email pre-launch switches verified fail-closed;
- public Storefront Chromium E2E across supported locales/viewports;
- disposable authenticated owner lifecycle: signup, onboarding, private areas, export, tenant delete and account delete;
- cross-tenant A/B isolation attempts;
- billing checkout must stop before Stripe while pricing is private;
- operational-role E2E for manager, reception, kitchen, staff, marketing and accounting;
- E2E cleanup verified with no disposable tenant/user residue.

## Operational-role expectations

- **Owner** — complete tenant administration, data protection and commercial controls.
- **Manager** — complete restaurant operations and team administration except owner-only destructive data actions.
- **Reception** — reservations, customers, events, takeaway flow, menu read and operational Insights.
- **Kitchen** — menu updates, reservation read, order status, stock read/update/adjust.
- **Staff** — menu/reservation/stock read and order status updates.
- **Marketing** — menu read/update/publish, events and Insights.
- **Accounting** — menu read, stock read, Insights and plan/subscription visibility.

Navigation is role-aware and runtime allowlists are guarded in CI. Tenant identity still comes exclusively from the authenticated server session.

## Safe test-mode invariants

These must remain true throughout internal QA:

- regional SaaS pricing rows remain private (`is_public=false`);
- Stripe live readiness remains disabled;
- no test is allowed to create a real Stripe charge;
- transactional email is disabled per tenant by default;
- email outbox remains empty unless a tenant is explicitly enabled later;
- Cloudinary media signing remains fail-closed until server-side credentials/preset exist;
- no secrets are exposed to the browser;
- disposable E2E users/organizations use the `mandys-e2e-*` convention and clean themselves up.

## What QA can test now

- account creation and restaurant onboarding;
- desktop/tablet/mobile Backoffice navigation;
- all seven operational roles and denied actions;
- profile/branding configuration using HTTPS media URLs;
- hours, dining areas and tables;
- menu CRUD, translations, allergens and publication;
- reservations, exceptions, waitlist and public availability;
- CRM/customer workflows;
- event-lead workflows;
- takeaway ordering and kitchen status;
- stock, recipes, suppliers and adjustments according to role;
- operational Insights;
- notifications and audit/activity;
- team invitations and memberships;
- plans/subscription display without live charging;
- retention settings, tenant export and owner-only tenant deletion;
- Storefront locales and public restaurant experiences.

## Provider/commercial activation not required for QA

These are intentionally deferred to an explicit launch decision:

- final public plan prices and taxes;
- Stripe account/live billing activation;
- payment-provider production webhooks/secrets;
- email sending provider token, sender domain and tenant enablement;
- Cloudinary server-side production secret/preset;
- any customer-facing online card payment for restaurant orders.

They are launch dependencies, not blockers for internal product validation.