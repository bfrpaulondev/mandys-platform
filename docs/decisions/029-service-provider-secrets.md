# ADR 029: Provider credentials remain server-side and tenant-scoped

**Status:** accepted

Future payment, AI, email or messaging credentials supplied by a tenant are stored and used only by server-side infrastructure. They are never exposed through `NEXT_PUBLIC_` configuration or serialized into storefront/backoffice payloads.

Tenant-owned provider projects are isolated per tenant where supported so usage, permissions and revocation remain controllable.
