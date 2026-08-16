# ADR 040: Future modules activate without tenant forks

**Status:** accepted

Orders, Stock, Analytics, Loyalty, Multi-location and AI are activated through tenant entitlements over the shared product codebase. Module activation may trigger tenant-scoped migrations or setup data, but it does not create a separate application fork.
