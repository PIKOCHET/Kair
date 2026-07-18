# KAIR — Full Flow Simulation Results (Section 6)

Code-review simulation of the 16-step production flow, traced against
the code on `main` after the audit fixes. Date: 2026-07-18.

## Step-by-step verdicts

| # | Step | Verdict | Notes |
|---|------|---------|-------|
| 1 | Customer places urgent order with KAIR50 | ✅ FIXED | Percentage promos previously stored `discount_paise = 1` and were **never applied** — ItemEntry now resolves the promo against the real item total (with `max_discount_paise` cap) and stores the true discount |
| 2 | Ops assigns rider Paresh | ✅ | + "on the way" customer notification |
| 3 | Rider accepts → picks up → enters 4 items | ✅ | Tags generated, customer notified with final (post-discount) total |
| 4 | Rider drops at Prerti's point | ✅ | Needs migration **005** applied (partner select + notification RLS) |
| 5 | Prerti sees order in Active Handover | ✅ | Needs migration **006** (partner SELECT on orders/order_items); realtime — appears without refresh |
| 6 | Bags Pending = 1, Commission = ₹25 | ✅ | Both driven by real queries (count + today's received transactions) |
| 7 | Prerti confirms batch handover | ✅ | Needs migration **006** (partner UPDATE) + **007** (partner INSERT on partner_transactions for the `dispatched` row) |
| 8 | Order status = in_transit_to_workshop | ✅ | + per-customer "Heading to workshop 🚐" notifications |
| 9 | Prerti's history shows the handover | ✅ | Orders tab → badge flips from "With you" to "Sent to workshop" |
| 10 | Ops moves cleaning stages → ready | ✅ | Status dropdown covers all 12 statuses; each fires its customer notification |
| 11 | Ops assigns delivery to Paresh | ✅ | New "🚀 Assign delivery rider" button on ready orders. Needs migration **007** (`orders.delivery_rider_id` column) — **button errors until 007 is run** |
| 12 | Paresh sees Deliveries section → delivers | ✅ | Blue DELIVERY badge, "Collect ₹X" (COD), Mark as Delivered + notification |
| 13 | Customer gets rating prompt | ✅ | Shows on delivered orders without a rating |
| 14 | Customer rates 5 stars | ✅ | "Thank you for choosing Kair ✨" |
| 15 | Ops stats show correct revenue | ✅ | Sum of delivered `total_paise` (now net of real promo discounts) |
| 16 | Settlement shows Prerti owed ₹25 | ✅ | Pending = unsettled received transactions; Mark Settled stamps `settled_at`. Needs migration **007** |

## ⚠️ Blockers that live in Supabase, not in this repo

The code is complete, but these must be done in the Supabase dashboard
before the flow passes end-to-end:

1. **Run migrations in order** (SQL Editor):
   - `supabase/migrations/005_partner_drop_rls.sql`
   - `supabase/migrations/006_partner_batch_rls.sql`
   - `supabase/migrations/007_prod_audit.sql`  ← new this audit
2. **Verify Prerti's ID chain** — run the diagnostic at the top of 007.
   If `channel_partner_id` is NULL, the commented INSERT in the same
   file creates her collection point record.
3. **Realtime replication** — Dashboard → Database → Replication:
   confirm `orders` (and ideally `notifications`) are in the
   `supabase_realtime` publication, or the live-update subscriptions
   silently receive nothing.

## Known remaining gaps (not launch blockers, tracked for next sprint)

- **batch_runs table unused** — ops Batch tab does per-partner collection
  directly on orders (works for the demo scale); named batch runs with a
  rider + date would need the `batch_runs` table verified in the DB and a
  create-run form.
- **Payments are COD-only** — Razorpay live keys still pending (CLAUDE.md TODO).
- **PWA / Privacy Policy / Terms** — still on the CLAUDE.md TODO list.
- **KAIRFIRST edge case** — fixed-type promos now also re-cap at item
  total, but promo usage is not limited to first order server-side.
