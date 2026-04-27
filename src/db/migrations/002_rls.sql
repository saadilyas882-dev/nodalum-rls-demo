-- ============================================================
-- 002_rls.sql  — Row-Level Security policies
--
-- Strategy: the application layer sets app.current_tenant_id
-- as a transaction-local variable before every query.
-- RLS policies read this variable — no tenant ID ever travels
-- in application query parameters, eliminating injection risk.
-- ============================================================

-- ---- Helper function ----------------------------------------
-- Reads the tenant context set by the application layer.
-- Returns NULL if not set (blocks all rows — safe default).
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- ---- Enable RLS on tenant-scoped tables ---------------------
ALTER TABLE matters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log  ENABLE ROW LEVEL SECURITY;

-- Superuser bypasses RLS by default in Postgres.
-- Force RLS even for table owner (important for migration scripts running as owner).
ALTER TABLE matters    FORCE ROW LEVEL SECURITY;
ALTER TABLE users      FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log  FORCE ROW LEVEL SECURITY;

-- ---- Matters ------------------------------------------------
DROP POLICY IF EXISTS matters_tenant_isolation ON matters;
CREATE POLICY matters_tenant_isolation ON matters
  FOR ALL
  USING     (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---- Users --------------------------------------------------
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  FOR ALL
  USING     (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ---- Audit Log ----------------------------------------------
DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;
CREATE POLICY audit_log_tenant_isolation ON audit_log
  FOR ALL
  USING     (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
