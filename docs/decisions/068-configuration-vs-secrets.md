# ADR 068: Product configuration and secrets are separate

**Status:** accepted

Tenant settings such as locale, timezone, theme and module activation are ordinary application data. Provider credentials and deployment secrets are stored separately with tighter access controls and are never returned as tenant configuration payloads.
