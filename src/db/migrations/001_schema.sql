-- ============================================================
-- 001_schema.sql  — Core tables for Nodalum multi-tenant schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants: one row per law firm / organisation
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Users: always scoped to a tenant
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('admin', 'user', 'viewer')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

-- Matters: legal cases — the core tenant-scoped resource
CREATE TABLE IF NOT EXISTS matters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed', 'pending')),
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log: immutable record of all AI-assisted actions
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  matter_id   UUID REFERENCES matters(id),
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at trigger for matters
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS matters_updated_at ON matters;
CREATE TRIGGER matters_updated_at
  BEFORE UPDATE ON matters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
