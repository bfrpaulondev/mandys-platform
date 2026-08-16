# ADR 002: Modular monolith first

**Status:** accepted

Mandy's starts as a modular monolith: separate applications and domain packages in one repository, one primary relational database and clear module boundaries.

Microservices would add deployment, networking, tracing, consistency and operational costs before the product has traffic or team-size pressure that justifies them. Domain events and package boundaries keep future extraction possible without paying that cost in V0.1.
