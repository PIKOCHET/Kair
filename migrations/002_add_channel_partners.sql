-- ============================================
-- Migration 002: Channel Partners & Batch Model
-- Date: 2026-05-15
-- ============================================

-- 1. CREATE channel_partners TABLE
CREATE TABLE IF NOT EXISTS channel_partners (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  address           TEXT,
  area              TEXT,
  city              TEXT DEFAULT 'Pune',
  lat               DECIMAL(10, 8),
  lng               DECIMAL(11, 8),
  coverage_radius_m INT DEFAULT 500,
  commission_paise  INT DEFAULT 2500, -- ₹25 per order
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE partner_transactions TABLE
CREATE TABLE IF NOT EXISTS partner_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_partner_id UUID NOT NULL REFERENCES channel_partners(id) ON DELETE CASCADE,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type              TEXT NOT NULL, -- 'received' | 'dispatched'
  commission_paise  INT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ALTER orders TABLE - ADD NEW COLUMNS
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS channel_partner_id UUID REFERENCES channel_partners(id),
ADD COLUMN IF NOT EXISTS batch_rider_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS at_partner_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS collected_by_batch_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispatched_to_partner_at TIMESTAMPTZ;

-- 4. CREATE INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_channel_partners_profile_id ON channel_partners(profile_id);
CREATE INDEX IF NOT EXISTS idx_channel_partners_area ON channel_partners(area);
CREATE INDEX IF NOT EXISTS idx_orders_channel_partner_id ON orders(channel_partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_batch_rider_id ON orders(batch_rider_id);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_partner_id ON partner_transactions(channel_partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_order_id ON partner_transactions(order_id);

-- 5. RLS POLICIES for channel_partners
ALTER TABLE channel_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_partners_select_own_or_admin" ON channel_partners
  FOR SELECT USING (
    auth.uid() = profile_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "channel_partners_update_own_or_admin" ON channel_partners
  FOR UPDATE USING (
    auth.uid() = profile_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "channel_partners_insert_admin" ON channel_partners
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 6. RLS POLICIES for partner_transactions
ALTER TABLE partner_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_transactions_select_own_or_admin" ON partner_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channel_partners
      WHERE id = partner_transactions.channel_partner_id
      AND profile_id = auth.uid()
    ) OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "partner_transactions_insert_own_or_admin" ON partner_transactions
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 7. UPDATE orders RLS to include new columns visibility
-- (Existing RLS should already handle this, but ensure riders can see their assigned orders with new columns)

COMMIT;
