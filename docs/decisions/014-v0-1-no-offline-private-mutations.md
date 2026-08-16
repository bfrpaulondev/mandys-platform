# ADR 014: No offline private mutations in V0.1

**Status:** accepted

The backoffice may be installed and its static application assets cached, but V0.1 does not queue reservation, customer, payment or inventory mutations while offline.

Offline writes will only ship with idempotency, conflict resolution, encryption and explicit synchronization states.
