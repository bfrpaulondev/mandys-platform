-- Read-only readiness gate for Mandy's multi-tenant isolation.
-- Run with psql against the target database. The script fails fast if a
-- tenant-owned table loses RLS, its tenant policy, or if browser-facing
-- Supabase roles gain direct table privileges in the private mandys schema.

DO $$
DECLARE
  offending_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', c.table_schema, c.table_name), ', ' ORDER BY c.table_name)
    INTO offending_tables
  FROM information_schema.columns c
  JOIN pg_tables t
    ON t.schemaname = c.table_schema
   AND t.tablename = c.table_name
  WHERE c.table_schema = 'mandys'
    AND c.column_name = 'organization_id'
    AND c.table_name NOT IN ('member', 'invitation')
    AND NOT t.rowsecurity;

  IF offending_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Mandy''s tenant tables without RLS: %', offending_tables;
  END IF;
END $$;

DO $$
DECLARE
  offending_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', c.table_schema, c.table_name), ', ' ORDER BY c.table_name)
    INTO offending_tables
  FROM information_schema.columns c
  WHERE c.table_schema = 'mandys'
    AND c.column_name = 'organization_id'
    AND c.table_name NOT IN ('member', 'invitation')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = c.table_schema
        AND p.tablename = c.table_name
        AND p.cmd = 'ALL'
        AND coalesce(p.qual, '') LIKE '%app.organization_id%'
        AND coalesce(p.with_check, '') LIKE '%app.organization_id%'
    );

  IF offending_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Mandy''s tenant tables missing organization-scoped ALL policy: %', offending_tables;
  END IF;
END $$;

DO $$
DECLARE
  offending_grants text;
BEGIN
  SELECT string_agg(
           format('%I.%I -> %I (%s)', table_schema, table_name, grantee, privilege_type),
           ', ' ORDER BY table_name, grantee, privilege_type
         )
    INTO offending_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'mandys'
    AND grantee IN ('anon', 'authenticated');

  IF offending_grants IS NOT NULL THEN
    RAISE EXCEPTION 'Direct Supabase client-role grants detected in mandys schema: %', offending_grants;
  END IF;
END $$;

SELECT 'mandys tenant isolation verified' AS readiness_result;
