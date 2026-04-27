const router = require('express').Router();
const { withTenantContext } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /matters
 * Returns only matters visible to the authenticated tenant.
 * RLS on the matters table enforces this — no WHERE clause needed.
 */
router.get('/', async (req, res) => {
  try {
    const matters = await withTenantContext(req.user.tenantId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, tenant_id, title, description, status, created_at
         FROM matters
         ORDER BY created_at DESC`
      );
      return rows;
    });
    res.json({ matters, tenantId: req.user.tenantId, count: matters.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /matters/:id
 * RLS returns zero rows if the matter belongs to a different tenant.
 * The caller receives a clean 404 — no information leak about the existence
 * of the row in another tenant.
 */
router.get('/:id', async (req, res) => {
  try {
    const matter = await withTenantContext(req.user.tenantId, async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM matters WHERE id = $1',
        [req.params.id]
      );
      return rows[0] ?? null;
    });
    if (!matter) return res.status(404).json({ error: 'Matter not found' });
    res.json({ matter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /matters
 * Creates a matter. tenant_id is taken from the JWT — never from the request body.
 * RLS WITH CHECK also blocks any attempt to INSERT with a foreign tenant_id.
 */
router.post('/', async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const matter = await withTenantContext(req.user.tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO matters (tenant_id, title, description, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, tenant_id, title, description, status, created_at`,
        [req.user.tenantId, title, description ?? null, req.user.userId]
      );
      return rows[0];
    });
    res.status(201).json({ matter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /matters/:id
 * Updates a matter. RLS blocks updates to rows belonging to other tenants.
 */
router.patch('/:id', async (req, res) => {
  const { title, description, status } = req.body;

  try {
    const matter = await withTenantContext(req.user.tenantId, async (client) => {
      const { rows } = await client.query(
        `UPDATE matters
         SET
           title       = COALESCE($1, title),
           description = COALESCE($2, description),
           status      = COALESCE($3, status)
         WHERE id = $4
         RETURNING *`,
        [title ?? null, description ?? null, status ?? null, req.params.id]
      );
      return rows[0] ?? null;
    });
    if (!matter) return res.status(404).json({ error: 'Matter not found' });
    res.json({ matter });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
