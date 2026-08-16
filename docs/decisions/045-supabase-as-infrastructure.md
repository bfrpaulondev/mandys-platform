# ADR 045: Supabase is infrastructure, not the domain model

**Status:** accepted

Mandy's can use Supabase for managed PostgreSQL and related services while keeping business logic in Mandy's packages. The domain model depends on PostgreSQL/Drizzle abstractions rather than Supabase-specific client objects throughout the application.
