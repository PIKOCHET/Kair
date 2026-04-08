-- ============================================================
-- Kair — Migration 002: RLS fixes + missing columns
-- Run this in: Supabase Dashboard → SQL Editor
-- Safe to run on an existing DB — uses IF NOT EXISTS / DO blocks
-- ============================================================

-- ── 1. Missing columns on orders ─────────────────────────────
-- These were used in code from the start but omitted from 001_schema.sql.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pickup_type     TEXT DEFAULT 'standard'
    CHECK (pickup_type IN ('standard', 'urgent')),
  ADD COLUMN IF NOT EXISTS items_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS estimated_delivery DATE;

-- ── 2. notifications table ────────────────────────────────────
-- RiderApp inserts a notification after item confirmation.

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  order_id   UUID REFERENCES orders(id)   ON DELETE CASCADE,
  type       TEXT,
  title      TEXT,
  message    TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Own notifications'
  ) THEN
    CREATE POLICY "Own notifications" ON notifications
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

-- ── 3. Riders: view pending_pickup orders (unassigned) ────────
-- Without this, riders can only see orders already assigned to them.
-- They need to see pending orders to accept them.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Riders view pending pickup'
  ) THEN
    CREATE POLICY "Riders view pending pickup" ON orders
      FOR SELECT USING (
        status = 'pending_pickup'
        AND EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'rider'
        )
      );
  END IF;
END $$;

-- ── 4. Riders: accept unassigned orders ──────────────────────
-- The existing "Riders update assigned" policy uses USING (rider_id = auth.uid()),
-- which requires the rider to already be set. This blocks self-assignment from
-- pending_pickup (where rider_id IS NULL). Add a separate policy for that case.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Riders accept pending pickup'
  ) THEN
    CREATE POLICY "Riders accept pending pickup" ON orders
      FOR UPDATE USING (
        status = 'pending_pickup'
        AND rider_id IS NULL
        AND EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'rider'
        )
      );
  END IF;
END $$;

-- ── 5. Riders: INSERT into order_items ───────────────────────
-- 001_schema.sql only has a SELECT policy for order_items.
-- Riders insert items during the pickup item-entry step.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Riders insert order items'
  ) THEN
    CREATE POLICY "Riders insert order items" ON order_items
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM orders
          WHERE id = order_id AND rider_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 6. Riders: INSERT garment_tags ───────────────────────────
-- 001_schema.sql only covers customer SELECT and admin ALL.
-- Riders generate tags after picking up clothes.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'garment_tags' AND policyname = 'Riders insert garment tags'
  ) THEN
    CREATE POLICY "Riders insert garment tags" ON garment_tags
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM orders
          WHERE id = order_id AND rider_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 7. Riders: UPDATE garment_tags ───────────────────────────
-- Riders update tag status during delivery (e.g., packed → out for delivery).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'garment_tags' AND policyname = 'Riders update garment tags'
  ) THEN
    CREATE POLICY "Riders update garment tags" ON garment_tags
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM orders
          WHERE id = order_id AND rider_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 8. Riders: SELECT garment_tags for their orders ──────────
-- Riders need to read tags for their assigned orders (shown in the order card).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'garment_tags' AND policyname = 'Riders view garment tags'
  ) THEN
    CREATE POLICY "Riders view garment tags" ON garment_tags
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM orders
          WHERE id = order_id AND rider_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── Done ──────────────────────────────────────────────────────
-- After running this, verify in Supabase:
--   Authentication → Policies → orders / order_items / garment_tags / notifications
