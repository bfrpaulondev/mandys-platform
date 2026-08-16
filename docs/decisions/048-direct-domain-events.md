# ADR 048: Domain events carry tenant ownership

**Status:** accepted

Every Mandy's domain event carries `organizationId` as part of its envelope. Consumers must keep the tenant boundary when writing audit, analytics, notification or AI-derived data.
