# ADR 004: Private data is network-only in V0.1

**Status:** accepted

The Mandy's backoffice is installable as a PWA, but V0.1 does not cache authenticated documents, API responses, customer data, reservations or payment-related traffic. Only application/static assets may be cached by the service worker.

Offline mutation support requires explicit conflict handling, idempotency and data-at-rest decisions. It will be introduced only when those guarantees are designed rather than by caching private responses opportunistically.
