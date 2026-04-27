# PostgreSQL Row-Level Security — Multi-Tenant Isolation Demo

Demonstrates tenant isolation enforced at the **database layer** using PostgreSQL Row-Level Security (RLS). No tenant filtering in application code — the database enforces it on every query.

---

## How it works

Each request sets a transaction-scoped variable (`app.current_tenant_id`) before any query runs. RLS policies on every table read that variable and silently filter or block rows that belong to a different tenant. The application layer never sees data it shouldn't.

The app connects as a **non-superuser role** (`nodalum_app`). This is required — PostgreSQL superusers bypass RLS unconditionally, so production apps must never connect as `postgres`.

---

## Stack

- Node.js / Express
- PostgreSQL 14+ with RLS
- JWT authentication
- Jest (tests against a real database — no mocks)

---

## Setup

```bash
npm install
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm run migrate             # runs all migrations + seed
npm test
```

---

## What the tests prove

8 tests, all hitting a live PostgreSQL instance:

| Test | Result |
|---|---|
| Tenant A lists matters | Only Tenant A rows returned |
| Tenant B lists matters | Only Tenant B rows returned |
| Tenant A fetches Tenant B matter by ID | `404` — row invisible, no data leak |
| Tenant B fetches Tenant A matter by ID | `404` |
| Tenant A inserts a matter | Always stamped with Tenant A — `WITH CHECK` blocks any cross-tenant attempt |
| Tenant A updates Tenant B matter | `404` — RLS hides it on `UPDATE` too |
| Direct DB query with wrong tenant context | Zero rows returned |
| Direct DB query with correct tenant context | Own rows visible |

---

## Seed credentials

| Tenant | Slug | Email | Password |
|---|---|---|---|
| Studio Legale Rossi | `rossi` | alice@rossi.it | `secret123` |
| Avvocati Bianchi & Co | `bianchi` | bob@bianchi.it | `secret123` |
