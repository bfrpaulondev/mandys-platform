# ADR 071: Client-generated operation ids may support idempotency later

**Status:** accepted

When Mandy's introduces offline-safe or retry-sensitive workflows, clients may generate operation identifiers used as idempotency keys. This is intentionally separate from tenant authorization and does not allow clients to choose authoritative database ownership.
