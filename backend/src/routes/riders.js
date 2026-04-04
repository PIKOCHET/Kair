const express  = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();

// ── GET /api/riders — list all riders with their current workload
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, area, is_active')
    .eq('role', 'rider')
    .eq('is_active', true);

  if (error) return res.status(500).json({ error: error.message });

  // Count active orders per rider
  const ridersWithLoad = await Promise.all(
    data.map(async (rider) => {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('rider_id', rider.id)
        .in('status', ['rider_assigned', 'picked_up', 'out_for_delivery']);

      return { ...rider, active_orders: count || 0 };
    })
  );

  res.json(ridersWithLoad);
});

// ── POST /api/riders/:id/assign — assign rider to an order
router.post('/:id/assign', async (req, res) => {
  const { order_id } = req.body;

  const { data, error } = await supabase
    .from('orders')
    .update({ rider_id: req.params.id, status: 'rider_assigned' })
    .eq('id', order_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PATCH /api/riders/:id/location — update rider GPS (called from rider app)
router.patch('/:id/location', async (req, res) => {
  const { lat, lng } = req.body;

  const { error } = await supabase
    .from('rider_locations')
    .upsert({ rider_id: req.params.id, lat, lng, updated_at: new Date().toISOString() });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
