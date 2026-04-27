-- ============================================================
-- 003_seed.sql  — Test data for two isolated tenants
-- Passwords: 'secret123' (bcrypt, cost 10)
-- ============================================================

INSERT INTO tenants (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Studio Legale Rossi', 'rossi'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Avvocati Bianchi & Co', 'bianchi')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, tenant_id, email, password_hash, role) VALUES
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'alice@rossi.it',
    '$2a$10$wCKPp4/NuuSulFQjpmmKMuA7vGvt43yUVnqGD90rzIVjXKk0wTWXC',
    'admin'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bob@bianchi.it',
    '$2a$10$wCKPp4/NuuSulFQjpmmKMuA7vGvt43yUVnqGD90rzIVjXKk0wTWXC',
    'admin'
  )
ON CONFLICT DO NOTHING;

INSERT INTO matters (id, tenant_id, title, description, created_by) VALUES
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Rossi v. Technovate — Contract Dispute',
    'Breach of shareholders agreement, damages €450,000',
    'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Bianchi M&A Due Diligence',
    'Acquisition review for TechCo S.r.l.',
    'dddddddd-dddd-dddd-dddd-dddddddddddd'
  )
ON CONFLICT DO NOTHING;
