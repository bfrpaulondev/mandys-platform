# ADR 065: Web surfaces and privileged Node services deploy separately

**Status:** accepted

Storefront and backoffice deploy as Next.js applications. The privileged Fastify API and future worker deploy as Node services. Shared packages keep one codebase while each surface scales and secures according to its workload.
