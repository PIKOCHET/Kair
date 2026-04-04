# Kair — Full Stack Scaffold
### Pune's 20-minute laundry & dry cleaning platform

---

## 📁 Project Structure

```
kair/
├── customer-app/        # React PWA — customer-facing app (EN/HI/MR)
├── rider-app/           # React PWA — rider pickup & delivery app
├── backend/             # Node.js + Express API server
└── supabase/            # Database schema, migrations, RLS policies
```

---

## 🧰 Tech Stack

| Layer        | Technology                            |
|--------------|---------------------------------------|
| Frontend     | React 18 + Vite + TailwindCSS         |
| Auth         | Supabase Auth (OTP via phone/SMS)     |
| Database     | Supabase (PostgreSQL + Realtime)      |
| Payments     | Razorpay (UPI, Cards, COD, Netbanking)|
| Backend API  | Node.js + Express                     |
| Hosting      | Vercel (frontend) + Railway (backend) |
| SMS/OTP      | Supabase + Twilio (fallback)          |

---

## 🚀 Quick Start

### 1. Clone & install all packages
```bash
# Customer app
cd customer-app && npm install

# Rider app
cd ../rider-app && npm install

# Backend
cd ../backend && npm install
```

### 2. Set up Supabase
1. Go to [supabase.com](https://supabase.com) → New project → name it `kair`
2. Go to SQL Editor → paste contents of `supabase/migrations/001_schema.sql` → Run
3. Go to Authentication → Providers → Enable **Phone** (uses Twilio under the hood)
4. Copy your Project URL and anon key

### 3. Set up Razorpay
1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com) → Sign up
2. Settings → API Keys → Generate Test Keys
3. Note your `Key ID` and `Key Secret`

### 4. Configure environment variables
Copy `.env.example` to `.env` in each folder and fill in your keys.

### 5. Run everything
```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Customer app
cd customer-app && npm run dev

# Terminal 3 — Rider app
cd rider-app && npm run dev
```

---

## 🗂️ Key Features Per App

### Customer App (`localhost:5173`)
- OTP login via mobile number
- Browse services: Clothes / Shoes / Curtains / Household
- Add to cart, checkout with address + time slot
- Razorpay payment (UPI, Card, COD, Netbanking)
- Live ETA countdown after booking
- Order tracker with step-by-step status
- Trilingual: English / Hindi / Marathi

### Rider App (`localhost:5174`)
- OTP login (rider account)
- See assigned pickups on a list
- Accept/reject pickup
- Mark: Picked up → Delivered
- View customer address + phone

### Operations Dashboard (embedded in customer-app `/ops`)
- All orders, filters, search
- Assign riders
- Tag each garment with a unique code
- Update order status
- Revenue stats

---

## 🔐 Security Notes
- All Razorpay payment verification happens **on the backend** (never expose Key Secret to frontend)
- Supabase Row Level Security (RLS) ensures customers only see their own orders
- Rider accounts have a separate role in the `profiles` table
