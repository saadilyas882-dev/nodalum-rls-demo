const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, withTenantContext } = require('../db/pool');

/**
 * POST /auth/login
 * Body: { tenantSlug, email, password }
 *
 * Lookup the tenant by slug (tenants table has no RLS — public read).
 * Then verify the user inside that tenant's context via RLS.
 * Returns a signed JWT containing tenantId, userId, email, role.
 */
router.post('/login', async (req, res) => {
  const { tenantSlug, email, password } = req.body;
  if (!tenantSlug || !email || !password) {
    return res.status(400).json({ error: 'tenantSlug, email, and password are required' });
  }

  try {
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug]
    );
    if (!tenantResult.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const tenantId = tenantResult.rows[0].id;

    // Query the user inside the RLS tenant context
    const user = await withTenantContext(tenantId, async (client) => {
      const { rows } = await client.query(
        'SELECT id, email, password_hash, role FROM users WHERE email = $1',
        [email]
      );
      return rows[0] ?? null;
    });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
