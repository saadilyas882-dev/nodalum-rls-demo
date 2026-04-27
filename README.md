# nodalum-rls-demo

Multi-tenant PostgreSQL Row-Level Security demo built for [Nodalum](https://nodalum.com) — a jurisdiction-aware legal AI platform.

This repo demonstrates tenant isolation enforced **at the database layer** using PostgreSQL Row-Level Security (RLS), not in application middleware.

---

## What this proves

| Scenario | Behaviour |
|---|---|
| Tenant A lists matters | Returns only Tenant A's rows — RLS filters automatically |
| Tenant A fetches Tenant B matter by ID | `404` — row is invisible, no information leak |
| Tenant A inserts a matter | `tenant_id` is always stamped from the JWT, never from the request body; `WITH CHECK` blocks any cross-tenant insert attempt |
| Tenant A updates Tenant B matter | `404` — RLS hides the row on `UPDATE` |
| Direct DB query with wrong tenant context | Zero rows returned — isolation holds at the wire level |

---

## Architecture

```
Request
  └─► Express route
        └─► authenticate() middleware  ← verifies JWT, extracts tenantId
              └─► withTenantContext(tenantId, async (client) => {
                    SET LOCAL app.current_tenant_id = '<uuid>'   ← scoped to this transaction
                    ... query ...
                  })
                    └─► PostgreSQL RLS policy reads current_tenant_id()
                          └─► Filters / blocks rows at storage layer
```

### Key design decisions

**`SET LOCAL` not `SET`** — `SET LOCAL` scopes the variable to the current transaction only. When the connection is returned to the pool, the variable is gone. `SET` would persist across pool reuse and leak context between requests.

**`FORCE ROW LEVEL SECURITY`** — By default, table owners bypass RLS. `FORCE ROW LEVEL SECURITY` means the policy applies even when the DB user is the table owner, protecting against migration scripts that accidentally run in an application context.

**`current_tenant_id()` function** — RLS policies reference a stable SQL function rather than inlining `current_setting(...)`. This makes the policies readable and lets us change the setting name in one place.

**tenant_id never from request body** — The `POST /matters` handler takes `tenant_id` from the verified JWT payload. Even if a client sends a `tenant_id` in the body, it is ignored. The `WITH CHECK` policy in the database is the final backstop.

---

## Database schema

```
tenants          users              matters            audit_log
─────────        ──────────────     ─────────────────  ──────────────────
id (PK)          id (PK)            id (PK)            id (PK)
name             tenant_id (FK) ←── tenant_id (FK) ←── tenant_id (FK)
slug             email              title              matter_id (FK)
created_at       password_hash      description        user_id (FK)
                 role               status             action
                 created_at         created_by (FK)    payload (JSONB)
                                    created_at         created_at
                                    updated_at
```

RLS is enabled on `matters`, `users`, and `audit_log`.  
`tenants` is public-read (no RLS) — needed for the login slug lookup.

---

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Install

```bash
npm install
```

### Configure

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET
```

### Migrate + seed

```bash
npm run migrate
```

This runs all `.sql` files in `src/db/migrations/` in order. The seed file (`003_seed.sql`) is skipped in `NODE_ENV=production`.

### Run

```bash
npm run dev
```

---

## API

All endpoints (except `/auth/login` and `/health`) require `Authorization: Bearer <token>`.

### `POST /auth/login`
```json
{ "tenantSlug": "rossi", "email": "alice@rossi.it", "password": "secret123" }
```
Returns `{ token }`.

### `GET /matters`
Returns all matters for the authenticated tenant.

### `GET /matters/:id`
Returns the matter if it belongs to the authenticated tenant. `404` otherwise.

### `POST /matters`
```json
{ "title": "New matter", "description": "Optional" }
```
Creates a matter stamped with the authenticated tenant's ID.

### `PATCH /matters/:id`
Partial update. Returns `404` if the matter is not visible to the authenticated tenant.

---

## Tests

Tests run against a **real PostgreSQL instance** — no mocks. This is intentional: we are testing the database layer, not the application layer.

```bash
cp .env.test.example .env.test
# Edit .env.test — point to your test database (can be same DB as dev)

npm run migrate   # ensure schema + seed are applied
npm test
```

### What the tests cover

- `Tenant A list` returns only Tenant A rows
- `Tenant B list` returns only Tenant B rows  
- `Tenant A` fetching a `Tenant B` matter by ID → `404`
- `Tenant B` fetching a `Tenant A` matter by ID → `404`
- Insert always stamps the JWT tenant — never cross-tenant
- `PATCH` on cross-tenant matter → `404`
- Direct DB query with wrong tenant context → zero rows

---

## Seed data

| Tenant | Slug | User | Password |
|---|---|---|---|
| Studio Legale Rossi | `rossi` | alice@rossi.it | `secret123` |
| Avvocati Bianchi & Co | `bianchi` | bob@bianchi.it | `secret123` |

Each tenant has one seeded matter. Tests use these fixed UUIDs defined in `003_seed.sql`.
