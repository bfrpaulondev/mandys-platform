# ADR 035: Mandy's database remains the operational source of truth

**Status:** accepted

AI output, analytics projections and integration caches do not become authoritative restaurant state by themselves. Authorized domain actions write validated state to Mandy's transactional database, and downstream views are derived from that state.
