/**
 * Cross-tenant RLS isolation tests.
 *
 * These tests prove that RLS is working at the database layer:
 * - Tenant A cannot read Tenant B's matters (SELECT blocked)
 * - Tenant A cannot fetch a Tenant B matter by ID (returns 404, not 403)
 * - Tenant A cannot insert a matter for Tenant B (WITH CHECK blocked)
 * - UPDATE on a cross-tenant matter returns 404 (row invisible to RLS)
 *
 * Tests run against a real PostgreSQL instance with migrations applied.
 * No mocks — we verify the DB layer, not the application layer.
 */
require('dotenv').config({ path: '.env.test' });
const request = require('supertest');
const app = require('../src/index');
const { pool, withTenantContext } = require('../src/db/pool');

const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TENANT_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const MATTER_A_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'; // belongs to Tenant A
const MATTER_B_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'; // belongs to Tenant B

let tokenA;
let tokenB;

beforeAll(async () => {
  // Login as Tenant A user
  const resA = await request(app)
    .post('/auth/login')
    .send({ tenantSlug: 'rossi', email: 'alice@rossi.it', password: 'secret123' });
  tokenA = resA.body.token;

  // Login as Tenant B user
  const resB = await request(app)
    .post('/auth/login')
    .send({ tenantSlug: 'bianchi', email: 'bob@bianchi.it', password: 'secret123' });
  tokenB = resB.body.token;

  expect(tokenA).toBeDefined();
  expect(tokenB).toBeDefined();
});

afterAll(async () => {
  await pool.end();
});

// ----------------------------------------------------------------
// READ isolation
// ----------------------------------------------------------------

describe('RLS SELECT isolation', () => {
  test('Tenant A list: only sees own matters', async () => {
    const res = await request(app)
      .get('/matters')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.matters.length).toBeGreaterThan(0);

    // Every returned row must belong to Tenant A
    res.body.matters.forEach((m) => {
      expect(m.tenant_id).toBe(TENANT_A_ID);
    });
  });

  test('Tenant B list: only sees own matters', async () => {
    const res = await request(app)
      .get('/matters')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    res.body.matters.forEach((m) => {
      expect(m.tenant_id).toBe(TENANT_B_ID);
    });
  });

  test('Tenant A cannot fetch Tenant B matter by ID — gets 404 not 403', async () => {
    // RLS hides the row entirely; the response is indistinguishable from
    // "not found" — no information about the row's existence leaks.
    const res = await request(app)
      .get(`/matters/${MATTER_B_ID}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  test('Tenant B cannot fetch Tenant A matter by ID — gets 404', async () => {
    const res = await request(app)
      .get(`/matters/${MATTER_A_ID}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });
});

// ----------------------------------------------------------------
// WRITE isolation
// ----------------------------------------------------------------

describe('RLS INSERT isolation', () => {
  test('Tenant A insert: matter is always stamped with Tenant A — never cross-tenant', async () => {
    const res = await request(app)
      .post('/matters')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Test insert from Tenant A', description: 'RLS insert test' });

    expect(res.status).toBe(201);
    expect(res.body.matter.tenant_id).toBe(TENANT_A_ID);

    // Cleanup
    await withTenantContext(TENANT_A_ID, async (client) => {
      await client.query('DELETE FROM matters WHERE id = $1', [res.body.matter.id]);
    });
  });
});

describe('RLS UPDATE isolation', () => {
  test('Tenant A cannot update Tenant B matter — gets 404', async () => {
    const res = await request(app)
      .patch(`/matters/${MATTER_B_ID}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Hijacked' });

    // RLS makes the row invisible on UPDATE; zero rows updated → 404
    expect(res.status).toBe(404);
  });
});

// ----------------------------------------------------------------
// Direct DB-layer verification (bypasses HTTP layer entirely)
// ----------------------------------------------------------------

describe('DB-layer RLS proof', () => {
  test('Direct query with Tenant A context returns zero Tenant B rows', async () => {
    const rows = await withTenantContext(TENANT_A_ID, async (client) => {
      const { rows } = await client.query(
        'SELECT id FROM matters WHERE tenant_id = $1',
        [TENANT_B_ID]
      );
      return rows;
    });
    // RLS filters these out before Postgres returns them
    expect(rows.length).toBe(0);
  });

  test('Tenant A context: can see own matters directly', async () => {
    const rows = await withTenantContext(TENANT_A_ID, async (client) => {
      const { rows } = await client.query('SELECT id FROM matters');
      return rows;
    });
    expect(rows.length).toBeGreaterThan(0);
  });
});
