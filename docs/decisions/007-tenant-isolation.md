# ADR 007: Session-derived tenancy plus RLS

**Status:** accepted

Tenant authorization is derived from the authenticated server session and active organization. Browser-supplied tenant ids are never trusted as an authorization source.

Every business table carries `organization_id`. Tenant database work executes in a transaction that sets a transaction-local PostgreSQL setting, and Row Level Security uses that value to restrict rows. Application authorization and database RLS are both required.
