-- ============================================
-- Migration 003: Create test users for new roles
-- Date: 2026-05-15
-- ============================================

-- Note: These inserts assume the auth users are already created in Supabase Auth.
-- The email addresses below should be created in Auth first, then these profiles can be inserted.

-- 1. Create channel partner test user profile
INSERT INTO profiles (id, email, role, full_name, phone, created_at)
VALUES (
  'cp-wakad-001',
  'test.partner.wakad@kair.app',
  'channel_partner',
  'Wakad Collection Point',
  '+919876543210',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Create batch rider test user profile
INSERT INTO profiles (id, email, role, full_name, phone, created_at)
VALUES (
  'br-batch-001',
  'test.batchrider@kair.app',
  'batch_rider',
  'Raj Singh (Van Driver)',
  '+919765432109',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Create channel partner location
INSERT INTO channel_partners (profile_id, name, address, area, city, lat, lng, coverage_radius_m, commission_paise, is_active)
VALUES (
  'cp-wakad-001',
  'Wakad Dark Store',
  'Near Wakad Chowk, Pune',
  'Wakad',
  'Pune',
  18.5912,
  73.7997,
  1000,
  2500, -- ₹25 per order
  true
) ON CONFLICT (id) DO NOTHING;

-- 4. Create additional channel partners for testing
INSERT INTO channel_partners (profile_id, name, address, area, city, lat, lng, coverage_radius_m, commission_paise, is_active)
VALUES
(
  (SELECT id FROM profiles LIMIT 1 OFFSET 1), -- Use a different profile if available
  'Hinjewadi Collection Hub',
  'Tech Park Area, Hinjewadi',
  'Hinjewadi',
  'Pune',
  18.5890,
  73.7297,
  1200,
  2500,
  true
),
(
  (SELECT id FROM profiles LIMIT 1 OFFSET 2), -- Use another profile if available
  'Kalyani Nagar Distribution Point',
  'Kalyani Nagar, Pune',
  'Kalyani Nagar',
  'Pune',
  18.5245,
  73.8830,
  800,
  2500,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Notes for manual setup:
-- 1. Create these users in Supabase Auth console:
--    - test.partner.wakad@kair.app (password: Test@123)
--    - test.batchrider@kair.app (password: Test@123)
--
-- 2. After creating in Auth, run this migration to set up their profiles
--
-- 3. Test flow:
--    - Login as batch_rider (Raj Singh)
--    - View today's collection route from all channel partners
--    - Login as channel_partner (Wakad Collection)
--    - View incoming orders from riders
--    - Accept orders and confirm handover to batch rider
