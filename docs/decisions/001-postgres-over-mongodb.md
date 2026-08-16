# ADR 001: PostgreSQL as the primary database

**Status:** accepted

Mandy's uses PostgreSQL, initially through Supabase-compatible infrastructure, rather than MongoDB as the primary transactional store.

The restaurant domain is strongly relational: tenants own locations; locations own areas and tables; menus own categories and items; reservations reference customers, tables and time ranges; future inventory links recipes, ingredients, suppliers, purchases and stock movements. These workflows benefit from foreign keys, constraints, transactions, joins and SQL analytics.

The decision does not change the React/Node/TypeScript application model. Infrastructure is isolated behind the data layer so specialized stores can be introduced later where they solve a concrete problem.
