-- ============================================================
-- 004_app_role.sql  — Dedicated application role
--
-- The application must NOT connect as a superuser.
-- Superusers bypass RLS unconditionally in PostgreSQL.
-- This role is a non-superuser — RLS policies apply to it fully.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nodalum_app') THEN
    CREATE ROLE nodalum_app LOGIN PASSWORD 'nodalum_app_pass';
  END IF;
END
$$;

-- Schema access
GRANT USAGE ON SCHEMA public TO nodalum_app;

-- Table-level permissions (RLS then filters rows at query time)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants, users, matters, audit_log
TO nodalum_app;

-- Sequence permissions for UUID generation (if needed)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nodalum_app;

-- Function permissions
GRANT EXECUTE ON FUNCTION current_tenant_id() TO nodalum_app;
GRANT EXECUTE ON FUNCTION set_updated_at() TO nodalum_app;
