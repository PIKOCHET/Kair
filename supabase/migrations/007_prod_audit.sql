-- ============================================================
-- Kair — Migration 007: Production audit fixes
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to re-run — uses IF NOT EXISTS / DROP POLICY IF EXISTS
-- Requires: 005_partner_drop_rls.sql and 006_partner_batch_rls.sql
-- ============================================================

-- ── 0. DIAGNOSTIC (read-only — run first, verify the ID chain) ──
-- SELECT u.email, u.id AS auth_id, p.id AS profile_id, p.role,
--        cp.id AS channel_partner_id, cp.name AS partner_name
-- FROM auth.users u
-- LEFT JOIN profiles p ON p.id = u.id
-- LEFT JOIN channel_partners cp ON cp.profile_id = p.id
-- WHERE u.email = 'prertikocheta@gmail.com';
--
-- SELECT id, order_number, status, channel_partner_id, at_partner_at
-- FROM orders WHERE channel_partner_id IS NOT NULL;
--
-- If the first query returns NULL channel_partner_id, create the record:
-- INSERT INTO channel_partners (profile_id, name, area, city)
-- SELECT id, 'Prerti Kocheta Collection Point', 'Wakad', 'Pune'
-- FROM profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'prertikocheta@gmail.com')
-- AND NOT EXISTS (SELECT 1 FROM channel_partners WHERE profile_id = profiles.id);

-- ── 1. Partners INSERT their own transactions ────────────────
-- Batch handover logs 'dispatched' rows; only riders/admins could
-- insert before, so the partner's insert silently failed.

DROP POLICY IF EXISTS "Partners insert own transactions" ON partner_transactions;
CREATE POLICY "Partners insert own transactions" ON partner_transactions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM channel_partners
    WHERE id = partner_transactions.channel_partner_id
    AND profile_id = auth.uid()
  )
);

-- ── 2. Settlement tracking ────────────────────────────────────
ALTER TABLE partner_transactions
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Admins update transactions" ON partner_transactions;
CREATE POLICY "Admins update transactions" ON partner_transactions
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── 3. Dedicated delivery rider on orders ─────────────────────
-- Stage 10/11: ops assigns a delivery rider for the return leg;
-- rider app shows a separate Deliveries section.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_rider_id UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_orders_delivery_rider_id ON orders(delivery_rider_id);

-- Delivery rider can see + update their delivery orders
DROP POLICY IF EXISTS "Delivery riders view their deliveries" ON orders;
CREATE POLICY "Delivery riders view their deliveries" ON orders
FOR SELECT USING (delivery_rider_id = auth.uid());

DROP POLICY IF EXISTS "Delivery riders update their deliveries" ON orders;
CREATE POLICY "Delivery riders update their deliveries" ON orders
FOR UPDATE USING (delivery_rider_id = auth.uid());

-- Delivery rider can notify the customer (delivered ✨)
DROP POLICY IF EXISTS "Delivery riders notify their orders" ON notifications;
CREATE POLICY "Delivery riders notify their orders" ON notifications
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE id = notifications.order_id AND delivery_rider_id = auth.uid()
  )
);

-- ── Done ──────────────────────────────────────────────────────
-- Verify: Authentication → Policies → orders / partner_transactions /
-- notifications. Then re-run the diagnostic at the top.
