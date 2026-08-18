# Performance sprint 6–10

This note records the measured decisions behind the second performance pass. The intent is to prevent speculative optimizations from adding complexity without evidence.

## 6 — Navigation prefetch

Protected navigation prefetches the Next.js route and, for the highest-value read surfaces, warms the existing short-lived in-memory cache. No private response is written to persistent browser storage.

## 7 — Optimistic operational actions

Reservation lifecycle changes, takeaway order status changes and notification read actions update the local UI immediately. Failed writes roll the affected local state back and expose the runtime error.

## 8 — Session/context reuse

All protected entrypoints now use the same `/api/dashboard` snapshot for session, active organization and role context instead of loading the legacy core context separately on deep links.

## 9 — Operational Edge gateway

The hottest authenticated operational API prefixes (Menu, Reservations, CRM, Orders, Stock and Notifications) are routed through the Netlify Edge gateway directly to their existing Supabase Edge runtimes. The allowlist is explicit and auth/data-protection routes are intentionally excluded.

## 10 — PostgreSQL critical-path investigation

Production `pg_stat_statements`, index usage and `EXPLAIN (ANALYZE, BUFFERS)` were inspected before considering new indexes.

Representative tenant-scoped reads on the current production dataset measured approximately:

- reservations (14-day window): 0.094 ms execution;
- menu list: 0.109 ms execution;
- CRM customer list: 0.101 ms execution;
- orders list: 0.077 ms execution;
- active ingredients list: 0.027 ms execution.

Frequently executed Mandy's statements also remain low-cost: tenant settings/menu translation/location/module entitlement reads are generally well below 1 ms mean execution, while audit inserts are only a few milliseconds on average.

Existing indexes are actively serving session-token, membership, reservation-capacity, CRM identity and stock paths. Several indexes have few or zero scans because the current tables are tiny and PostgreSQL correctly prefers a sequential scan; that is not evidence that those indexes are unnecessary at commercial scale.

**Decision:** no speculative production index migration in this sprint. Current measured latency is dominated by network/runtime hops rather than PostgreSQL execution. Re-run this investigation with larger pilot datasets and add an index only when a real query plan or latency distribution supports it.
