# ADR 066: Operational state changes are transactional

**Status:** accepted

Reservation, order, payment and future stock workflows that update multiple related records execute transactionally where consistency requires it. Cross-cutting side effects are emitted after the authoritative state transition rather than being allowed to leave partial operational state.
