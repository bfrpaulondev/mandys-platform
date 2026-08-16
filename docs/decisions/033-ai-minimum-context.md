# ADR 033: AI receives minimum necessary context

**Status:** accepted

Mandy's AI features receive only the tenant-authorized records required for the requested analysis. Providers are not given unrestricted database connections or cross-tenant datasets.

AI outputs that can materially change operational data are treated as suggestions until a separately authorized application action executes the change.
