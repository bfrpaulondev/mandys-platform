# ADR 011: Cost-conscious shared infrastructure first

**Status:** accepted

Mandy's starts with shared multi-tenant infrastructure rather than one database or deployment per restaurant. PostgreSQL/Supabase-compatible infrastructure, Vercel-hosted Next.js applications and a small Node API/worker footprint keep early fixed costs low.

Dedicated infrastructure remains an enterprise deployment option, not the default architecture.
