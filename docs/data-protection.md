# Data protection baseline

Mandy's is designed to minimize unnecessary personal data while still supporting restaurant operations.

## Shipped safeguards

- Reservation service messages and marketing consent are separate concepts.
- Marketing consent stores timestamp and source and can be withdrawn independently.
- Customer notes must be operationally relevant; sensitive data should not be collected casually.
- Public storefront requests avoid exposing internal identifiers when a stable public slug can be used.
- Logs must not contain raw authorization credentials or unnecessary request bodies.
- Tenant-wide export is owner-only and excludes credentials, tokens, provider customer/subscription identifiers and audit IP hashes.
- Tenant deletion is owner-only and removes operational data plus the Better Auth organization in one database transaction.
- Better Auth's generic organization deletion endpoint is disabled so it cannot bypass Mandy's tenant cleanup.
- User-account deletion is enabled only after the user has no remaining Mandy's organization memberships.

## Before broad production onboarding

- Retention periods must become tenant-configurable and enforced by scheduled cleanup.
- External processors (payments, email/SMS, media and future AI providers) must be documented in the production privacy/processors inventory when enabled.
- Backup retention and restoration procedures must align with the application's deletion/retention policy.

AI features will use scoped, minimum-necessary context and will not receive unrestricted database access.

This document describes engineering practices and is not a blanket legal-compliance claim.
