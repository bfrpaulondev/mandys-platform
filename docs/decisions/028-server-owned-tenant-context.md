# ADR 028: Tenant context is never a client authorization parameter

**Status:** accepted

The browser may identify a resource or request a tenant switch through an authenticated organization workflow, but API authorization always resolves the active organization from server-validated session state.

A query string, request body, header or route parameter containing `organizationId` cannot grant access to that organization by itself.
