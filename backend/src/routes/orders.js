const express  = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();

// ── GET /api/orders — all orders (admin/ops use)
router.get('/', async (req, res) => {
  const { status, date } = req.query;

  let query = supabase
    .from('orders')
    .select(`
      *,
      customer:profiles!orders_customer_id_fkey(full_name, phone),
      rider:profiles!orders_rider_id_fkey(full_name, phone),
      address:addresses(flat_no, area, city),
      items:order_items(*, service:services(name_en, emoji)),
      tags:garment_tags(*)
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (date)   query = query.eq('pickup_date', date);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── GET /api/orders/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:profiles!orders_customer_id_fkey(full_name, phone),
      rider:profiles!orders_rider_id_fkey(full_name, phone),
      address:addresses(*),
      items:order_items(*, service:services(name_en, emoji)),
      tags:garment_tags(*),
      history:order_status_history(*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Order not found' });
  res.json(data);
});

// ── PATCH /api/orders/:id/status — update order status
router.patch('/:id/status', async (req, res) => {
  const { status, rider_id } = req.body;

  const update = { status };
  if (status === 'picked_up')  update.picked_up_at  = new Date().toISOString();
  if (status === 'delivered')  update.delivered_at  = new Date().toISOString();
  if (status === 'rider_assigned' && rider_id) update.rider_id = rider_id;

  const { data, error } = await supabase
    .from('orders')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PATCH /api/orders/:id/tags — bulk update garment tags
router.patch('/:id/tags', async (req, res) => {
  // tags: [{ id, status, notes }]
  const { tags } = req.body;

  const updates = tags.map(tag =>
    supabase
      .from('garment_tags')
      .update({ status: tag.status, notes: tag.notes, updated_at: new Date().toISOString() })
      .eq('id', tag.id)
  );

  await Promise.all(updates);
  res.json({ success: true });
});

// ── POST /api/orders/:id/generate-tags — create garment tag records after pickup
router.post('/:id/generate-tags', async (req, res) => {
  const { data: order, error } = await supabase
    .from('orders')
    .select('order_number, items:order_items(id, service_name, quantity)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Order not found' });

  const tags = [];
  let counter = 1;

  for (const item of order.items) {
    for (let i = 0; i < item.quantity; i++) {
      tags.push({
        order_id:      req.params.id,
        order_item_id: item.id,
        tag_code:      `${order.order_number}-${String(counter).padStart(2, '0')}`,
        item_name:     item.service_name,
        status:        'received',
      });
      counter++;
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('garment_tags')
    .insert(tags)
    .select();

  if (insertError) return res.status(500).json({ error: insertError.message });
  res.json(inserted);
});

module.exports = router;
