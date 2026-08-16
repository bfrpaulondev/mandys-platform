# Data protection baseline

Mandy's is designed to minimize unnecessary personal data while still supporting restaurant operations.

- Reservation service messages and marketing consent are separate concepts.
- Marketing consent stores timestamp and source and can be withdrawn independently.
- Customer notes must be operationally relevant; sensitive data should not be collected casually.
- Public storefront requests should avoid exposing internal identifiers when a stable public slug can be used.
- Logs must not contain raw authorization credentials or unnecessary request bodies.
- Tenant exports and deletion workflows will be implemented before production onboarding.
- Retention periods will be tenant-configurable before production onboarding.
- AI features will use scoped, minimum-necessary context and will not receive unrestricted database access.

This document describes engineering practices and is not a blanket legal-compliance claim.
