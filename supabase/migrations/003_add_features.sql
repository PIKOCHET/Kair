-- ============================================================
-- Kair — Feature 1, 2, 3 Migrations
-- Feature 1: Special instructions (already in schema as special_notes)
-- Feature 2: Order rating
-- Feature 3: Promo codes
-- ============================================================

-- Feature 2: Order Rating Table
CREATE TABLE IF NOT EXISTS order_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES profiles(id),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for order_ratings
ALTER TABLE order_ratings ENABLE ROW LEVEL SECURITY;

-- Customers see only their own ratings
CREATE POLICY "Customers view own ratings" ON order_ratings FOR SELECT
  USING (customer_id = auth.uid());

-- Customers can insert their own ratings
CREATE POLICY "Customers insert own ratings" ON order_ratings FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Admins can view all ratings
CREATE POLICY "Admins view all ratings" ON order_ratings FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Feature 3: Promo code columns (add to existing orders table)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_paise INT DEFAULT 0;

-- Create promo code reference table
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INT NOT NULL,  -- percentage (e.g., 50 for 50%) or paise (e.g., 20000 for ₹200)
  max_discount_paise INT,  -- max discount for percentage-based (e.g., KAIRFIRST = 20000)
  is_active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  usage_limit INT,  -- null = unlimited
  usage_count INT DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert hardcoded promo codes
INSERT INTO promo_codes (code, discount_type, discount_value, max_discount_paise, is_active, description)
VALUES
  ('KAIR50', 'percentage', 50, NULL, TRUE, '50% off first order'),
  ('KAIRFIRST', 'fixed', 20000, 20000, TRUE, 'First order free (up to ₹200)'),
  ('SOCIETY10', 'percentage', 10, NULL, TRUE, '10% off always')
ON CONFLICT (code) DO NOTHING;

-- Enable RLS for promo_codes (public read)
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read promo codes" ON promo_codes FOR SELECT USING (is_active = TRUE);
