# ADR 021: Critical changes produce audit records

**Status:** accepted

Mandy's records critical operational changes with tenant, actor, action, entity, request and metadata context. Audit records are append-oriented and are not used as the primary state store.

The first schema includes the audit foundation so reservations, menu publishing, access control, future payments, stock adjustments and AI actions can adopt a common model.
