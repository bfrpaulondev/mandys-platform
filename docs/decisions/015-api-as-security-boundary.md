# ADR 015: The API is the privileged security boundary

**Status:** accepted

Privileged business operations are executed by the Fastify API, not directly from browser code with service credentials. The API resolves authenticated identity, tenant, role and module entitlement before domain work.

Supabase is initially the PostgreSQL platform, not permission to expose service-role access to the browser.
