-- ============================================================
-- Kair — Image Upload Feature Migration
-- Adds order_images table for stains, damage documentation
-- ============================================================

-- Create order_images table
CREATE TABLE IF NOT EXISTS order_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id),
  image_url TEXT NOT NULL,
  description TEXT,
  image_type TEXT CHECK (image_type IN ('stain', 'damage', 'instruction', 'pickup', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Supabase storage bucket for order images (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-images', 'order-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for order_images
ALTER TABLE order_images ENABLE ROW LEVEL SECURITY;

-- Customers and riders can view images for their orders
CREATE POLICY "Users view order images" ON order_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE id = order_id
      AND (customer_id = auth.uid() OR rider_id = auth.uid())
    )
  );

-- Customers and riders can upload images for orders they're involved with
CREATE POLICY "Users upload images" ON order_images FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM orders
      WHERE id = order_id
      AND (customer_id = auth.uid() OR rider_id = auth.uid())
    )
  );

-- Admins can view and manage all images
CREATE POLICY "Admin manage images" ON order_images FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage policies
CREATE POLICY "Public read order images" ON storage.objects
  FOR SELECT USING (bucket_id = 'order-images');

CREATE POLICY "Authenticated upload images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'order-images' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users delete own images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'order-images' AND
    owner = auth.uid()
  );
