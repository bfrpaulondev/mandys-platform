# ADR 043: Fastify is the Node API boundary

**Status:** accepted

Mandy's uses Fastify for the privileged Node API because it provides a small, explicit server boundary for authentication, tenant resolution, validation, rate limiting, integrations and future webhooks while keeping the React applications focused on presentation.
