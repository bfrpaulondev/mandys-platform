# ADR 020: Tenant id leads business indexes

**Status:** accepted

High-frequency business indexes start with `organization_id` whenever queries are tenant-scoped. Examples include reservation date/status indexes and customer email/phone lookup.

This matches the authorization boundary and prevents early schema growth from producing cross-tenant scan patterns.
