# ADR 067: Notifications follow authoritative state changes

**Status:** accepted

Reservation confirmations, event updates and future order notifications are triggered from successful domain state changes. Notification delivery failure does not silently roll back an already valid restaurant operation; failures are retried or surfaced separately.
