-- ============================================================
-- Kair — Migration 005: Rider "Drop at Channel Partner" flow
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to run on an existing DB — uses DROP POLICY IF EXISTS
-- ============================================================

-- ── 1. Riders update their own orders ────────────────────────
-- Needed so the rider can set channel_partner_id / status /
-- at_partner_at when dropping an order at a collection point.

DROP POLICY IF EXISTS "Riders update own orders" ON orders;
CREATE POLICY "Riders update own orders" ON orders
FOR UPDATE USING (
  rider_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ── 2. Riders insert partner_transactions ────────────────────
-- Records the commission owed to the partner on drop-off.

DROP POLICY IF EXISTS "Riders insert transactions" ON partner_transactions;
CREATE POLICY "Riders insert transactions" ON partner_transactions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('rider', 'admin')
  )
);

-- ── 3. Riders view active channel partners ───────────────────
-- The existing "Partners see own data" policy only lets a partner
-- see their OWN row (profile_id = auth.uid()). Without this, the
-- rider's "Select Collection Point" list would always be empty.

DROP POLICY IF EXISTS "Riders view active partners" ON channel_partners;
CREATE POLICY "Riders view active partners" ON channel_partners
FOR SELECT USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('rider', 'batch_rider', 'admin')
  )
);

-- ── 4. Riders insert notifications for OTHER users ───────────
-- The existing "Own notifications" policy is FOR ALL USING
-- (user_id = auth.uid()), which also gates INSERT — a rider can
-- only insert a notification row where user_id is their own id.
-- The drop-off flow needs the rider to notify the PARTNER and the
-- CUSTOMER, neither of which is the rider. This policy is additive
-- (permissive policies are OR'd) and only widens INSERT.

DROP POLICY IF EXISTS "Riders insert notifications for their orders" ON notifications;
CREATE POLICY "Riders insert notifications for their orders" ON notifications
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM orders
    WHERE id = order_id AND rider_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ── Done ──────────────────────────────────────────────────────
-- After running this, verify in Supabase:
--   Authentication → Policies → orders / partner_transactions /
--   channel_partners / notifications
