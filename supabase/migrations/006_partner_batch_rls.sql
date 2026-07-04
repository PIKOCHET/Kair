-- ============================================================
-- Kair — Migration 006: Channel Partner + Batch Rider RLS
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to re-run — uses DROP POLICY IF EXISTS
--
-- Required for:
--   Stage 7 — partner sees orders + Confirm Batch Handover
--   Stage 8 — batch rider collects for workshop
-- Without these, partner order reads and the handover update
-- are silently blocked by RLS.
-- ============================================================

-- ── 1. Partners SELECT orders at their collection point ──────
-- 001_schema.sql only grants order SELECT to customers/riders/
-- admins. The partner dashboard queries orders by
-- channel_partner_id and gets zero rows without this.

DROP POLICY IF EXISTS "Partners view orders at their point" ON orders;
CREATE POLICY "Partners view orders at their point" ON orders
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM channel_partners
    WHERE id = orders.channel_partner_id AND profile_id = auth.uid()
  )
);

-- ── 2. Partners UPDATE orders at their collection point ──────
-- Needed for Confirm Batch Handover:
-- at_channel_partner → in_transit_to_workshop

DROP POLICY IF EXISTS "Partners update orders at their point" ON orders;
CREATE POLICY "Partners update orders at their point" ON orders
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM channel_partners
    WHERE id = orders.channel_partner_id AND profile_id = auth.uid()
  )
);

-- ── 3. Partners SELECT order_items for those orders ──────────
-- Active Handover cards show item counts; the order_items SELECT
-- policy only covers the order's customer and rider.

DROP POLICY IF EXISTS "Partners view order items" ON order_items;
CREATE POLICY "Partners view order items" ON order_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN channel_partners cp ON cp.id = o.channel_partner_id
    WHERE o.id = order_items.order_id AND cp.profile_id = auth.uid()
  )
);

-- ── 4. Partners INSERT notifications for their orders' customers ──
-- Handover notifies each customer ("Heading to workshop 🚐").

DROP POLICY IF EXISTS "Partners notify customers of their orders" ON notifications;
CREATE POLICY "Partners notify customers of their orders" ON notifications
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN channel_partners cp ON cp.id = o.channel_partner_id
    WHERE o.id = notifications.order_id AND cp.profile_id = auth.uid()
  )
);

-- ── 5. Batch riders SELECT + UPDATE hub-and-spoke orders ─────
-- BatchRiderScreens bulk-updates orders at partners
-- (at_channel_partner → in_transit_to_workshop → dispatched_to_partner).

DROP POLICY IF EXISTS "Batch riders view hub orders" ON orders;
CREATE POLICY "Batch riders view hub orders" ON orders
FOR SELECT USING (
  status IN ('at_channel_partner', 'in_transit_to_workshop', 'ready', 'dispatched_to_partner')
  AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'batch_rider'
  )
);

DROP POLICY IF EXISTS "Batch riders update hub orders" ON orders;
CREATE POLICY "Batch riders update hub orders" ON orders
FOR UPDATE USING (
  status IN ('at_channel_partner', 'in_transit_to_workshop', 'ready', 'dispatched_to_partner')
  AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'batch_rider'
  )
);

-- ── Done ──────────────────────────────────────────────────────
-- Verify: Authentication → Policies → orders / order_items /
-- notifications
