# ADR 046: External input is validated at application boundaries

**Status:** accepted

Mandy's uses shared Zod contracts for request and cross-application payload validation. Database constraints remain the final integrity layer; validation in React forms is a user-experience aid, not an authorization or integrity boundary.
