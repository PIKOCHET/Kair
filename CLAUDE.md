# Kair — Project Context for Claude

Premium laundry & dry cleaning app for Pune, India. Customers book pickups,
riders collect and deliver, ops team manages everything from a dashboard.

- **Live URL:** kair-xi.vercel.app
- **GitHub:** github.com/PIKOCHET/Kair
- **Git user:** PIKOCHET

---

## Architecture

Single React app (`customer-app/`) with role-based routing — no separate
frontend repos per role. The URL is the same for everyone; `App.jsx` reads
`profile.role` from Supabase and renders the correct screen.

```
customer-app/src/
├── App.jsx                     # Root router: login → role → screen
├── context/AuthContext.jsx     # user, profile, signOut, updateProfile
├── lib/
│   ├── supabase.js             # Supabase client (anon key)
│   └── constants.js            # C (colors), STATUS_CONFIG, CATALOG, fmt
└── screens/
    ├── LoginScreen.jsx         # Email + password (sign in / sign up)
    ├── CustomerApp.jsx         # Customer-facing PWA (home, pickup, orders, account)
    ├── RiderApp.jsx            # Rider dashboard (accept, pickup, item entry, deliver)
    └── OpsApp.jsx              # Admin dashboard (orders, riders, tags, stats)
```

```
backend/src/
├── index.js                    # Express server, port 3001
└── routes/
    ├── orders.js               # GET /orders, PATCH /:id/status, POST /:id/generate-tags
    ├── payments.js             # POST /create-order, POST /verify, POST /webhook
    └── riders.js               # GET /riders, POST /:id/assign, PATCH /:id/location
```

```
supabase/migrations/
└── 001_schema.sql              # Full schema — run once in Supabase SQL Editor
```

---

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Frontend   | React 18 + Vite (no Tailwind — all inline styles) |
| Auth       | Supabase Auth — email + password (see Known Issues)|
| Database   | Supabase (PostgreSQL + Realtime)                  |
| Payments   | Razorpay (UPI, Card, COD, Netbanking)             |
| Backend    | Node.js + Express (Railway)                       |
| Hosting    | Vercel (customer-app) + Railway (backend)         |

---

## Brand & Design

- **Navy:** `#0D1B3E` — primary, headers, buttons
- **Saffron:** `#E8590A` — CTAs, active states, prices
- **Cream:** `#FAF8F4` — page backgrounds
- **Linen:** `#F0EBE3` — card backgrounds, dividers
- **Stone:** `#6B6860` — secondary text
- **Gold:** `#C8A96E` — decorative accents

Fonts: `Cormorant Garamond` (headings/brand), `DM Sans` (body).
All styling is inline — no CSS files, no Tailwind classes, no CSS modules.
`C.*` constants from `constants.js` are used everywhere for colors.

---

## Role Routing (`App.jsx`)

```
Not logged in        → LoginScreen
profile.role = admin → OpsApp
profile.role = rider → RiderApp
profile.role = customer (default) → CustomerApp
```

To create an admin or rider: sign up normally, then in Supabase SQL Editor:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'you@example.com';
UPDATE profiles SET role = 'rider' WHERE email = 'rider@example.com';
```

---

## Customer App — Screens & Views

State machine inside `CustomerApp` using a `view` string:

| `view`      | Component       | Description                              |
|-------------|-----------------|------------------------------------------|
| `home`      | `HomeView`      | Greeting, active order cards, pickup CTAs, price list |
| `confirm`   | `ConfirmView`   | Choose/enter address, confirm pickup type |
| `confirmed` | `ConfirmedView` | Countdown timer, order number, track button |
| `orders`    | `OrdersView`    | Full order history with garment tags     |
| `account`   | `AccountView`   | Profile info, saved addresses, sign out  |

Bottom nav tabs: Home · Orders · Account.
Account tab navigates to `AccountView` — **does not sign out directly**.

### Pickup types
- `standard` — within 1 hour
- `urgent` — priority, shown with ⚡

---

## Rider App — Flow

All riders see all `pending_pickup` orders (unassigned) plus their own
assigned orders. Status transitions a rider can trigger:

```
pending_pickup  →  rider_assigned  (Accept & assign to me)
rider_assigned  →  picked_up       (Mark picked up)
picked_up       →  in_cleaning     (Hand to facility)
                +  Enter items screen (if items not yet confirmed)
out_for_delivery → delivered       (Mark delivered)
```

After picking up, rider uses `ItemEntry` to select services from `CATALOG`,
which inserts `order_items`, creates `garment_tags`, and sets
`orders.items_confirmed = true`, `orders.total_paise`, and
`orders.estimated_delivery`.

GPS location is upserted to `rider_locations` every 30 seconds via
`navigator.geolocation`.

---

## Ops (Admin) Dashboard — Features

Three tabs: **Orders** · **Riders** · **Stats**

- Search by order number, customer name, area
- Filter by status
- Expand order card to see items, garment tags, details
- Assign / reassign / unassign riders via modal
- Update status via dropdown (any transition, no restrictions)
- Generate garment tags (calls `POST /api/orders/:id/generate-tags` on backend)
- Tag modal: update individual garment status through all stages
- Stats tab: revenue, avg order value, breakdown by status

---

## Database Schema

### `profiles`
Extends `auth.users`. Auto-created on signup via trigger.
```
id            UUID (PK, FK → auth.users)
full_name     TEXT
phone         TEXT UNIQUE
role          TEXT  — 'customer' | 'rider' | 'admin'
area          TEXT
city          TEXT  DEFAULT 'Pune'
avatar_url    TEXT
language_pref TEXT  DEFAULT 'en'
is_active     BOOLEAN DEFAULT true
created_at    TIMESTAMPTZ
```

### `addresses`
```
id          UUID (PK)
user_id     UUID (FK → profiles)
label       TEXT  DEFAULT 'Home'
flat_no     TEXT
building    TEXT
area        TEXT  NOT NULL
landmark    TEXT
city        TEXT  DEFAULT 'Pune'
pincode     TEXT
lat, lng    DOUBLE PRECISION
is_default  BOOLEAN DEFAULT false
created_at  TIMESTAMPTZ
```

### `orders`
```
id                  UUID (PK)
order_number        TEXT UNIQUE  — auto-generated as KR-XXXX by trigger
customer_id         UUID (FK → profiles)
address_id          UUID (FK → addresses)
rider_id            UUID (FK → profiles)
status              TEXT — see order statuses below
payment_method      TEXT — 'upi' | 'card' | 'cod' | 'netbanking'
payment_status      TEXT — 'pending' | 'paid' | 'failed' | 'refunded'
razorpay_order_id   TEXT
razorpay_payment_id TEXT
total_paise         INT  DEFAULT 0
pickup_type         TEXT — 'standard' | 'urgent'  (added in practice, not in schema)
pickup_slot         TEXT
pickup_date         DATE
estimated_delivery  DATE  (added in practice — see Known Issues)
items_confirmed     BOOLEAN  (added in practice — see Known Issues)
special_notes       TEXT
language            TEXT  DEFAULT 'en'
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ  (auto-updated by trigger)
picked_up_at        TIMESTAMPTZ
delivered_at        TIMESTAMPTZ
```

**Order statuses** (in flow order):
`pending_pickup` → `rider_assigned` → `picked_up` → `in_cleaning` →
`quality_check` → `ready` → `out_for_delivery` → `delivered`
(also: `cancelled`)

### `order_items`
```
id             UUID (PK)
order_id       UUID (FK → orders)
service_id     UUID (FK → services, nullable — rider uses local CATALOG)
service_name   TEXT  — snapshot at time of entry
quantity       INT
price_paise    INT  — per unit
subtotal_paise INT  GENERATED (quantity × price_paise)
```

### `garment_tags`
Individual item tracking. Tag code format: `KR-2041-01`.
```
id            UUID (PK)
order_id      UUID (FK → orders)
order_item_id UUID (FK → order_items, nullable)
tag_code      TEXT
item_name     TEXT
status        TEXT — received | sorting | in_cleaning | drying |
                     pressed | quality_check | ready | packed
notes         TEXT
updated_at    TIMESTAMPTZ
updated_by    UUID (FK → profiles)
```

### `order_status_history`
Auto-populated by trigger on every `orders.status` change.
```
id          UUID (PK)
order_id    UUID (FK → orders)
old_status  TEXT
new_status  TEXT
changed_by  UUID (FK → profiles)
notes       TEXT
created_at  TIMESTAMPTZ
```

### `payments`
```
id                  UUID (PK)
order_id            UUID (FK → orders)
razorpay_order_id   TEXT
razorpay_payment_id TEXT
razorpay_signature  TEXT
amount_paise        INT
currency            TEXT DEFAULT 'INR'
method              TEXT
status              TEXT DEFAULT 'created'
captured_at         TIMESTAMPTZ
created_at          TIMESTAMPTZ
```

### `service_categories` + `services`
Seed data in `001_schema.sql`. In practice the app uses the hardcoded
`CATALOG` object in `constants.js` — the DB tables exist but the frontend
does not query them.

### `rider_locations`
```
rider_id    UUID (PK, FK → profiles)
lat, lng    DOUBLE PRECISION
updated_at  TIMESTAMPTZ
```

### Realtime enabled on: `orders`, `garment_tags`, `rider_locations`

### RLS summary
- `profiles`: own row only (admins can see all)
- `orders`: customers see own, riders see assigned, admins see all
- `addresses`: own rows only
- `order_items`, `garment_tags`: readable if you own the parent order
- `services`, `service_categories`: public read

---

## Service Catalog (`constants.js` — source of truth for frontend)

Prices in paise (₹1 = 100 paise):

| Category | Service | Price | Unit | TAT |
|----------|---------|-------|------|-----|
| Clothes | Wash & Fold | ₹49 | per kg | 2d |
| Clothes | Wash & Iron | ₹79 | per kg | 4d |
| Clothes | Dry Cleaning | ₹149 | per item | 7d |
| Clothes | Jacket / Coat | ₹199 | per item | 7d |
| Clothes | Saree / Lehenga | ₹129 | per item | 7d |
| Clothes | Denims / Jeans | ₹59 | per piece | 2d |
| Shoes | Sneaker Deep Clean | ₹299 | per pair | 7d |
| Shoes | Leather Shoes Polish | ₹199 | per pair | 7d |
| Shoes | Heels / Sandals | ₹149 | per pair | 7d |
| Curtains | Regular | ₹99 | per panel | 4d |
| Curtains | Blackout | ₹149 | per panel | 4d |
| Curtains | Sofa Cover | ₹129 | per piece | 4d |
| Household | Bedsheet set | ₹129 | per set | 2d |
| Household | Blanket / Duvet | ₹249 | per piece | 4d |
| Household | Bath Towels | ₹39 | per piece | 2d |

---

## Environment Variables

### `customer-app/.env`
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=https://kair-backend.railway.app
VITE_RAZORPAY_KEY_ID=
```

### `backend/.env`
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
PORT=3001
FRONTEND_URL=https://kair-xi.vercel.app
```

---

## Known Issues & Schema Gaps

### ✅ Fixed in `002_rls_fixes.sql` (run this on any fresh DB)
The following were bugs in the original schema — all resolved in migration 002:

| Issue | Fix |
|-------|-----|
| Missing `pickup_type`, `items_confirmed`, `estimated_delivery` columns on `orders` | `ALTER TABLE orders ADD COLUMN IF NOT EXISTS …` |
| Missing `notifications` table | `CREATE TABLE IF NOT EXISTS notifications …` |
| No INSERT policy for riders on `order_items` | `"Riders insert order items"` policy added |
| No INSERT/UPDATE/SELECT policy for riders on `garment_tags` | Three rider policies added |
| No SELECT policy for riders on unassigned `pending_pickup` orders | `"Riders view pending pickup"` policy added |
| No UPDATE policy allowing riders to self-assign on `pending_pickup` orders | `"Riders accept pending pickup"` policy added |

### Auth is email + password, not phone OTP
`LoginScreen.jsx` uses `supabase.auth.signInWithPassword` / `signUp` with
email + password. The README and schema mention phone OTP (Twilio) but
that is not implemented. Do not add phone auth without updating LoginScreen.

### `service_id` is always `null` in `order_items`
Rider's `ItemEntry` inserts `service_id: null` because it uses the local
`CATALOG` constants (which have short IDs like `'c1'`) rather than UUID
foreign keys from the `services` DB table. The two catalogs are kept in
sync manually.

### Rider app shows all unassigned orders to all riders
Any logged-in rider sees every `pending_pickup` order (after 002 policies
are applied). This is intentional for now (Pune only, small team) but will
need geofencing or manual routing as scale grows.

### OpsApp calls backend for tag generation; everything else is direct Supabase
`OpsApp` uses `fetch(${VITE_API_URL}/api/orders/:id/generate-tags)` for
one action, but all other mutations go directly through the Supabase client.
The backend is not required for the app to function except for Razorpay
payment creation/verification and this one endpoint.

### Address `is_default` on new address
New address in AccountView auto-sets `is_default: true` only when it's the
first address. If the user already has addresses and adds a new one, they
must explicitly tap "Set default" from the Account screen.

---

## Deployment

| Service | What it hosts |
|---------|---------------|
| Vercel  | `customer-app/` (also serves rider and ops via role routing) |
| Railway | `backend/` (Express API) |
| Supabase | PostgreSQL + Auth + Realtime |

Vercel auto-deploys on push to `main`. No build step needed beyond what
Vite provides — `npm run build` outputs to `dist/`.

### Razorpay test credentials
- Card: `4111 1111 1111 1111` · any future expiry · any CVV
- UPI success: `success@razorpay`
- UPI fail: `failure@razorpay`

---

## Development

```bash
# Customer app (also serves rider/ops via role routing)
cd customer-app && npm run dev   # http://localhost:5173

# Backend API
cd backend && npm run dev        # http://localhost:3001
```

No linter or test suite currently configured.
