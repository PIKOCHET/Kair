require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// Raw body for Razorpay webhooks (must be before express.json)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────
app.use('/api/payments', require('./routes/payments'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/riders',   require('./routes/riders'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'Kair API' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Kair backend running on port ${PORT}`));
