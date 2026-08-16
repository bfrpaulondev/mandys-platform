# ADR 008: Product modules and themes use entitlements

**Status:** accepted

Commercial access is explicit in the data model. Product capabilities use module entitlements and visual themes use theme entitlements.

This allows Mandy's to start with a small sellable configuration and activate Orders, Stock, Analytics, AI or future themes later without creating customer-specific forks. Entitlements control access; they do not replace permission checks inside an enabled module.
