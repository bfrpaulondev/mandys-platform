# ADR 017: External providers stay behind Mandy's interfaces

**Status:** accepted

Payments, media, email, AI and future messaging providers are integrated behind application interfaces when the abstraction has practical value. Domain code should depend on Mandy's capabilities rather than provider-specific SDK objects.

This keeps the product replaceable and supports dedicated customer configurations without forking core business logic.
