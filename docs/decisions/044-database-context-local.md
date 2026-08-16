# ADR 044: PostgreSQL tenant settings are transaction-local

**Status:** accepted

The API sets `app.organization_id` with PostgreSQL `set_config(..., true)` inside a transaction. The `true` flag makes the setting local to that transaction so a pooled connection cannot accidentally retain one tenant's context for a later request.
