# ADR 003: Themes are presentation entitlements

**Status:** accepted

Mandy's restaurant themes are presentation packages over shared domain data. Theme selection and token overrides are tenant settings; theme ownership is represented by a separate entitlement from product modules.

The included `Mandy's Minimal` theme is the baseline. Future paid themes must not duplicate business logic, database tables or API implementations. This keeps theme sales inexpensive to maintain and allows a restaurant to change presentation without migrating its operational data.
