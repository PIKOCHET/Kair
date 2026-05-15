# KAIR — Claude Code Project Brief v2.0 — Hub & Spoke Model

## Overview
Premium on-demand laundry & dry cleaning app, Pune India.
Built in React 18 + Vite + Supabase. Single unified app, role-based routing.
Live: kair-xi.vercel.app | GitHub: github.com/PIKOCHET/Kair

---

## Tech Stack
- Frontend: React 18 + Vite (customer-app/)
- Auth + DB: Supabase (sdlgiymtvxeayadjjnsj.supabase.co)
- Backend: Node.js + Express on Railway (kair-production.up.railway.app)
- Hosting: Vercel (auto-deploys on every push to main)
- Fonts: Cormorant Garamond (display/headings) + DM Sans (body)

---

## Brand Colors
- Navy:   #0D1B3E (primary dark)
- Saffron: #E8590A (CTA buttons, key highlights)
- Cream:  #FAF8F4 (page backgrounds)
- Gold:   #C8A96E (premium accents)
- Stone:  #6B6860 (body text, labels)
- Linen:  #F0EBE3 (card backgrounds, dividers)
- Teal:   #0D7377 (channel partner color) ⭐ NEW

---

## Project Structure
```
customer-app/src/
├── App.jsx                        — main router + login screen
├── main.jsx                       — entry point
├── context/AuthContext.jsx        — auth state + role detection
├── lib/supabase.js                — supabase client
├── lib/constants.js               — colors, CATALOG, fmt helpers
└── screens/
    ├── LoginScreen.jsx            — login/signup
    ├── CustomerScreens.jsx        — home, confirm, orders, account
    ├── RiderScreens.jsx           — pickup rider dashboard + item entry
    ├── ChannelPartnerScreens.jsx  — ⭐ NEW — dark store dashboard
    ├── BatchRiderScreens.jsx      — ⭐ NEW — van/bulk collection
    └── OpsScreens.jsx             — admin ops dashboard
```

---

## User Roles (profiles.role) — 5 Total

| Role | Who | Dashboard |
|------|-----|-----------|
| customer | Society resident | Home + pickup + orders + account |
| rider | Area pickup/delivery rider | Active pickups + item entry + deliveries |
| channel_partner | Dark store / kirana owner | ⭐ NEW — receive orders, hand to batch rider |
| batch_rider | Van driver for bulk runs | ⭐ NEW — collection route + workshop drop |
| admin | Snehal / ops manager | Full dashboard — all orders, partners, stats |

---

## Role-Based Routing (App.jsx) ✓
```javascript
profile.role === 'customer'         → CustomerApp
profile.role === 'rider'            → RiderApp
profile.role === 'channel_partner'  → ChannelPartnerApp  ⭐ NEW
profile.role === 'batch_rider'      → BatchRiderApp       ⭐ NEW
profile.role === 'admin'            → OpsDashboard
```

---

## Test Users (Supabase)
- piyushkocheta@gmail.com    → role: customer (Piyush)
- snehal.kankariya@gmail.com → role: admin (Snehal)
- evaan27kocheta@gmail.com   → role: rider (Paresh)
- **TODO**: Create test users for channel_partner and batch_rider

---

## NEW BUSINESS MODEL v2.0 — Hub & Spoke via Channel Partners

### Old Flow (v1):
```
Customer → Rider → Workshop → Rider → Customer
```

### New Flow (v2):
```
Customer
  ↓ (pickup rider stays in their area)
Pickup Rider collects from multiple customers
  ↓ (drops all items)
Channel Partner / Dark Store (accumulates orders all day)
  ↓ (end of day 6-9pm — single efficient trip)
Batch Rider (van) collects from ALL partners in one route
  ↓
Workshop (overnight processing)
  ↓ (morning — batch rider drops area-wise bundles)
Batch Rider delivers back to Channel Partners
  ↓
Pickup Rider collects from partner and delivers to doors
  ↓
Customer receives + pays on delivery
```

### Economics:
- **Pickup Rider**: 3x more orders/day (stays in zone)
- **Cost Reduction**: 60% cheaper logistics (batch aggregation)
- **Partner Revenue**: ₹25-30 commission per order
- **Scalability**: Can expand to any city without new infrastructure

---

## Order Statuses (11 Total) ✓

```javascript
pending_pickup              // customer placed order
rider_assigned              // pickup rider assigned  
picked_up                   // rider collected from customer
at_channel_partner          // ⭐ NEW — dropped at dark store
in_transit_to_workshop      // ⭐ NEW — batch rider collected
in_cleaning                 // at workshop
quality_check               // quality inspection
ready                       // packed + ready
dispatched_to_partner       // ⭐ NEW — batch rider dropped at partner
out_for_delivery            // rider heading to customer
delivered                   // final
cancelled                   // customer cancelled
```

---

## Database Changes ✓

### New Tables Created (Migration 002)

**channel_partners**
```sql
CREATE TABLE channel_partners (
  id                UUID PRIMARY KEY,
  profile_id        UUID NOT NULL REFERENCES profiles(id),
  name              TEXT NOT NULL,
  address           TEXT,
  area              TEXT,
  city              TEXT DEFAULT 'Pune',
  lat/lng           DECIMAL (geo coordinates),
  coverage_radius_m INT DEFAULT 500,
  commission_paise  INT DEFAULT 2500, -- ₹25 per order
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ
);
```

**partner_transactions**
```sql
CREATE TABLE partner_transactions (
  id                UUID PRIMARY KEY,
  channel_partner_id UUID REFERENCES channel_partners(id),
  order_id          UUID REFERENCES orders(id),
  type              TEXT, -- 'received' | 'dispatched'
  commission_paise  INT,
  created_at        TIMESTAMPTZ
);
```

### Orders Table — New Columns Added ✓
```sql
ALTER TABLE orders ADD COLUMN:
- channel_partner_id      UUID REFERENCES channel_partners(id)
- batch_rider_id          UUID REFERENCES profiles(id)
- at_partner_at           TIMESTAMPTZ
- collected_by_batch_at   TIMESTAMPTZ
- dispatched_to_partner_at TIMESTAMPTZ
```

---

## Channel Partner Dashboard (ChannelPartnerScreens.jsx) ✓ Placeholder

**Features:**
- Today's orders — list with customer name, order number, items count
- Accept incoming button (scan QR or tap)
- Handover to batch rider button
- Stats strip: received X, pending Y, handed over Z
- Earnings view: today's commission, monthly total
- History tab: past 7 days

---

## Batch Rider Dashboard (BatchRiderScreens.jsx) ✓ Placeholder

**Features:**
- Today's route — list of channel partners to collect from
- Each partner shows: name, address, order count, maps link
- "Collected from this partner" confirmation button
- Morning delivery run — drop bundles zone-wise
- Workshop handover confirmation
- Stats: orders collected, orders delivered, km driven

---

## Ops Dashboard Enhancements (TODO)

### New Tabs Needed:

1. **Channel Partners**
   - List all partners: name, area, current order count, status
   - Add new partner form
   - Edit partner details (coverage zone, commission)
   - Daily performance metrics per partner
   - Settlement/payout report

2. **Batch Runs**
   - Create batch route (assign batch rider + partner list)
   - Today's batch collection status
   - Morning delivery status
   - History of batch runs
   - Route optimization map

3. **Enhanced Stats**
   - Orders by zone/area
   - Partner performance ranking
   - Batch rider efficiency metrics
   - Cost per order (v1 vs v2 comparison)
   - Revenue split analysis

---

## Notifications (All Triggers) — TODO

| Trigger | Recipient | Message |
|---------|-----------|---------|
| Order placed | Customer | "KR-XXXX confirmed! Rider picking up soon." |
| Items confirmed | Customer | "X items collected · ₹XXX · Est. {date}" |
| At channel partner | Customer ⭐ | "Clothes safely at {partner_name}" |
| In cleaning | Customer | "Being professionally cleaned ✨" |
| Quality check | Customer | "Final checks in progress..." |
| Ready | Customer | "Fresh and ready! Delivery today." |
| Out for delivery | Customer | "Rider on the way with your items!" |
| Delivered | Customer | "Delivered! ✨ We hope you love it." |
| New drop at partner | Channel Partner ⭐ | "X orders received from rider" |
| Batch route created | Batch Rider ⭐ | "Route ready: 4 partners, 47 orders" |
| Ready for pickup | Batch Rider ⭐ | "Workshop ready for morning collection" |

---

## Investor Demo Flow (Updated v2.0)

1. Customer (Piyush) → request Urgent pickup
2. Admin (Snehal) → assign Paresh (rider) + (Wakad partner)
3. Rider (Paresh) → accept → pickup → enter items → drop at Wakad partner
4. Channel Partner → 📱 notify + acknowledge receipt (status = at_channel_partner)
5. Batch Rider → collect from Wakad partner → deliver to workshop
6. Admin → mark in_cleaning → quality_check → ready
7. Batch Rider → collect from workshop → drop at Wakad partner (morning)
8. Rider (Paresh) → collect from partner → deliver to Piyush's door
9. Customer → 📱 "Delivered!" → marks received → pays ✓
10. Repeat for 20+ orders in Piyush's area (same rider, different partner drops)

---

## Git Workflow — ALWAYS do this after every fix
```bash
git add -A
git commit -m "type: short description"
git push origin main
```
Vercel auto-deploys in ~2 minutes. Never leave code uncommitted.

---

## RLS Policy Rules (Supabase) ✓

- **profiles**: SELECT open to all — prevents recursion
- **orders**: customers see own, riders see assigned + unassigned, admins see all
- **channel_partners**: channel_partner sees own, admins see all ✓
- **partner_transactions**: partner sees own, admins see all ✓
- **notifications**: users see only their own

---

## Known Issues / TODO

**COMPLETED:**
- ✓ Database migrations for channel_partners + partner_transactions
- ✓ New order statuses (11 total)
- ✓ New roles: channel_partner, batch_rider
- ✓ Placeholder screens for both new roles
- ✓ Teal brand color added

**IN PROGRESS / TODO:**
- [ ] Channel partner screens — full implementation
- [ ] Batch rider screens — full implementation  
- [ ] Ops dashboard — Channel Partners + Batch Runs tabs
- [ ] Create test users for channel_partner and batch_rider
- [ ] Order routing logic — assign orders to channel partners by area
- [ ] Implement all notification triggers
- [ ] Commission auto-calculation + settlement reports
- [ ] Batch rider route optimization (maps integration)
- [ ] Click & Collect option for customers
- [ ] PWA setup (installable app)
- [ ] Razorpay live payment keys
- [ ] Privacy Policy + Terms pages
- [ ] Analytics dashboard (order volume, ARR, retention)
- [ ] Partner onboarding flow
- [ ] Mobile app (React Native / Expo)
