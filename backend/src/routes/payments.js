const express  = require('express');
const crypto   = require('crypto');
const Razorpay = require('razorpay');
const supabase = require('../lib/supabase');

const router = express.Router();

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ────────────────────────────────────────────────────────────
// POST /api/payments/create-order
// Called by the customer app to create a Razorpay order before checkout
// Body: { order_id (our DB order UUID), amount_paise, customer_name, customer_phone }
// ────────────────────────────────────────────────────────────
router.post('/create-order', async (req, res) => {
  try {
    const { order_id, amount_paise, customer_name, customer_phone } = req.body;

    if (!order_id || !amount_paise) {
      return res.status(400).json({ error: 'order_id and amount_paise are required' });
    }

    // Create Razorpay order
    const rzpOrder = await razorpay.orders.create({
      amount:   amount_paise,       // in paise
      currency: 'INR',
      receipt:  order_id,
      notes: {
        customer_name,
        customer_phone,
        platform: 'Kair Pune',
      },
    });

    // Save razorpay_order_id to our DB
    await supabase
      .from('orders')
      .update({ razorpay_order_id: rzpOrder.id })
      .eq('id', order_id);

    // Also save to payments table
    await supabase.from('payments').insert({
      order_id,
      razorpay_order_id: rzpOrder.id,
      amount_paise,
      status: 'created',
    });

    res.json({
      razorpay_order_id: rzpOrder.id,
      amount:            rzpOrder.amount,
      currency:          rzpOrder.currency,
      key_id:            process.env.RAZORPAY_KEY_ID,  // safe to send to frontend
    });

  } catch (err) {
    console.error('create-order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/payments/verify
// Called after Razorpay checkout succeeds on frontend
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id }
// ────────────────────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id,
    } = req.body;

    // Verify signature using HMAC SHA256
    const body      = razorpay_order_id + '|' + razorpay_payment_id;
    const expected  = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Payment is legit — update our DB
    await supabase
      .from('orders')
      .update({
        payment_status:      'paid',
        razorpay_payment_id: razorpay_payment_id,
      })
      .eq('id', order_id);

    await supabase
      .from('payments')
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status:       'captured',
        captured_at:  new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpay_order_id);

    res.json({ success: true, message: 'Payment verified successfully' });

  } catch (err) {
    console.error('verify error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/payments/webhook
// Razorpay sends events here — configure in Razorpay dashboard
// URL: https://your-backend.railway.app/api/payments/webhook
// ────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  const webhookSecret   = process.env.RAZORPAY_WEBHOOK_SECRET;
  const receivedSig     = req.headers['x-razorpay-signature'];
  const body            = req.body; // raw Buffer

  // Verify webhook authenticity
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  if (receivedSig !== expectedSig) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const event   = JSON.parse(body.toString());
  const payload = event.payload?.payment?.entity;

  if (event.event === 'payment.captured' && payload) {
    // Update payment record
    await supabase
      .from('payments')
      .update({ status: 'captured', captured_at: new Date().toISOString() })
      .eq('razorpay_payment_id', payload.id);

    // Update order
    await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('razorpay_order_id', payload.order_id);

    console.log(`✅ Payment captured: ${payload.id}`);
  }

  if (event.event === 'payment.failed' && payload) {
    await supabase
      .from('payments')
      .update({ status: 'failed' })
      .eq('razorpay_payment_id', payload.id);

    console.log(`❌ Payment failed: ${payload.id}`);
  }

  res.json({ received: true });
});

module.exports = router;
