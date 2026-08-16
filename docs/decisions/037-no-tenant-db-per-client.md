# ADR 037: Shared multi-tenant database is the default

**Status:** accepted

Early Mandy's tenants share the same PostgreSQL deployment with tenant-scoped rows and RLS. A separate database per restaurant would increase fixed cost and operational overhead before isolation requirements justify it.

Dedicated databases remain a future deployment option for enterprise contracts that require them.
