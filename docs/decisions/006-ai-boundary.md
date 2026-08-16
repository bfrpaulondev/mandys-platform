# ADR 006: AI is a provider boundary, not a core dependency

**Status:** accepted

Mandy's AI consumes authorized restaurant data through application services. AI providers do not receive direct database access and the core restaurant modules do not depend on a specific model vendor.

The `@mandys/ai` package defines the provider contract. A future tenant may use a Mandy's-managed AI allowance or an isolated provider account/project configured for that tenant. Provider credentials remain server-only.
