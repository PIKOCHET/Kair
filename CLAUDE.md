# Kair — Project Context for Claude Code

## Overview
Premium on-demand laundry & dry cleaning app, Pune India.
Built in React + Vite + Supabase. Single app, role-based routing.
Live: kair-xi.vercel.app | GitHub: github.com/PIKOCHET/Kair

## Tech Stack
- Frontend: React 18 + Vite
- Auth + DB: Supabase (sdlgiymtvxeayadjjnsj.supabase.co)
- Backend: Node.js + Express on Railway (kair-production.up.railway.app)
- Hosting: Vercel (auto-deploys on push to main)

## Project Structure
customer-app/src/
├── App.jsx                    — main router + login screen
├── main.jsx                   — entry point
├── context/AuthContext.jsx    — auth state + role detection
├── lib/supabase.js            — supabase client
├── lib/constants.js           — colors, CATALOG, fmt helpers
└── screens/
    ├── CustomerScreens.jsx    — home, confirm, confirmed, orders, account
    ├── RiderScreens.jsx       — rider dashboard + item entry
    └── OpsScreens.jsx         — admin ops dashboard

## Brand
Colors: navy #0D1B3E, saffron #E8590A, cream #FAF8F4, gold #C8A96E
Fonts: Cormorant Garamond (display) + DM Sans (body)
Order prefix: KR-XXXX

## Test Users (Supabase)
- piyushkocheta@gmail.com  → role: customer (Piyush)
- snehal.kankariya@gmail.com → role: admin (Snehal)  
- evaan27kocheta@gmail.com → role: rider (Paresh)

## Role-Based Routing (App.jsx)
profile.role = 'customer' → CustomerApp (home + orders + account)
profile.role = 'rider'    → RiderApp (pickups + item entry)
profile.role = 'admin'    → OpsDashboard (all orders + assign + stats)

## Investor Demo Flow
1. Customer (Piyush) → tap Urgent pickup → confirm address
2. Admin (Snehal) → sees new order → assigns Paresh as rider
3. Rider (Paresh) → accepts → marks picked up → enters items → confirms
4. Customer (Piyush) → My Orders → sees items + total + ETA + tags

## Key Supabase Tables
- profiles (id, role, full_name, phone)
- orders (id, order_number, customer_id, rider_id, status, pickup_type, total_paise, estimated_delivery, items_confirmed)
- order_items (id, order_id, service_name, quantity, price_paise)
- garment_tags (id, order_id, tag_code, item_name, status)
- addresses (id, user_id, flat_no, area, landmark, city, is_default)
- notifications (id, user_id, order_id, type, title, message, is_read)

## Order Status Flow
pending_pickup → rider_assigned → picked_up → in_cleaning → quality_check → ready → out_for_delivery → delivered

## Known Issues To Fix
- [ ] Account button logs out — should show AccountScreen
- [ ] AccountScreen needs: profile + saved addresses + sign out
- [ ] Rider item entry header shows blank address
- [ ] Customer notification after rider confirms items

## Git Workflow (ALWAYS do this after every fix)
git add -A
git commit -m "fix: [short description]"
git push origin main

Vercel auto-deploys in ~2 minutes after push.
Never leave fixes uncommitted.

## RLS Policy Rules (Supabase)
- profiles: SELECT open to all (prevents recursion)
- orders: riders can read unassigned + their own
- orders: riders can UPDATE (status, rider_id)
- order_items: riders can INSERT
- garment_tags: riders can INSERT + UPDATE  
- addresses: riders can SELECT
- notifications: users see only their own
