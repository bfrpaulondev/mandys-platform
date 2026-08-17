# Data protection baseline

Mandy's minimizes unnecessary personal data while supporting restaurant operations.

## Shipped safeguards
- Service messages and marketing consent are separate; consent stores timestamp/source and can be withdrawn.
- Tenant export is owner-only and excludes credentials, tokens, provider customer/subscription identifiers and audit IP hashes.
- Tenant deletion is owner-only and removes operational data plus the Better Auth organization atomically.
- Better Auth generic organization deletion is disabled; user deletion is allowed only after no Mandy's memberships remain.
- Retention policy is owner-configurable for customer data, audit records and in-app notifications. NULL/blank means no automatic deletion policy for that category.
- Retention values are constrained to 30–3650 whole days and policy changes are audited.

## Retention execution
Saving a retention period does **not** delete data. Automated enforcement stays disabled until category-specific cleanup/anonymization semantics are implemented and reviewed. Mandy's does not assume one universal legal retention period across countries, fiscal contexts or restaurant workflows.

Customer cleanup is especially sensitive because reservations, orders and events can have operational, accounting or legal retention requirements. Automatic cleanup must define what is anonymized versus deleted before activation.

## Before broad production onboarding
- Activate retention executors only after category-specific review.
- Document external processors when payments, email/SMS, media and AI providers are enabled.
- Align backup retention/restoration with deletion and retention policy.

AI features will use scoped, minimum-necessary context and will not receive unrestricted database access.

This document describes engineering practices and is not a blanket legal-compliance claim.
