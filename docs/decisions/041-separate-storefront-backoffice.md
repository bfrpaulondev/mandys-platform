# ADR 041: Storefront and backoffice are separate applications

**Status:** accepted

The guest-facing storefront and staff-facing backoffice have different performance, caching, authentication and product concerns. They share domain contracts, UI primitives and theme data where appropriate, but deploy as separate Next.js applications.

The backoffice is installable as a PWA; the storefront prioritizes public discovery, SEO and restaurant branding.
