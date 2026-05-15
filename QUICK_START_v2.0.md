# Kair v2.0 Quick Start Guide

## 5-Minute Setup & Test

### Prerequisites
- Node.js + npm installed
- Supabase account with existing Kair database
- Vercel account (for deployment)
- Git installed

---

## Step 1: Pull Latest Code (1 min)

```bash
cd ~/projects/kair
git pull origin main

# Verify 8 new commits
git log --oneline -8
```

Expected output:
```
dc25ca2 docs: add comprehensive Phase 2 implementation summary
0734ecd docs: add test users migration for channel_partner and batch_rider roles
f4e3041 feat: add order routing logic to auto-assign orders to nearest channel partners
865b572 feat: implement full batch rider dashboard with collection and delivery routes
fdd8ee8 feat: implement full channel partner dashboard with orders and stats
a67de44 docs: update CLAUDE.md to v2.0 hub-and-spoke business model
60bfd85 feat: add channel_partner and batch_rider roles with placeholder screens
c5669ee feat: add teal color and new order statuses for channel partner model
```

---

## Step 2: Setup Supabase (Database Migrations) (2 min)

### Option A: Manual SQL (Recommended for testing)

1. Open Supabase Dashboard: https://app.supabase.com
2. Navigate to: SQL Editor → New Query
3. Copy-paste migrations in order:

**Migration 1 - Database Schema**
```
File: migrations/002_add_channel_partners.sql
Copy entire content and execute
```

**Migration 2 - Test Users**
```
File: migrations/003_create_test_users.sql
Copy entire content and execute
(Note: Adjust profile_id values as needed for your setup)
```

### Option B: Programmatic (Via CLI)
```bash
# Install Supabase CLI if not already installed
npm install -g @supabase/cli

# Link to your Supabase project
supabase link --project-ref sdlgiymtvxeayadjjnsj

# Run migrations
supabase db push
```

---

## Step 3: Create Test Users in Auth (1 min)

### Supabase Auth Console:

1. Go to: Authentication → Users
2. Click "Invite user" 

**User 1 - Channel Partner**
- Email: `test.partner.wakad@kair.app`
- Password: `Test@123456`
- Role: channel_partner (will be set by Migration 003)

**User 2 - Batch Rider**
- Email: `test.batchrider@kair.app`
- Password: `Test@123456`
- Role: batch_rider (will be set by Migration 003)

---

## Step 4: Run Development Server (1 min)

```bash
cd customer-app

# Install dependencies
npm install

# Start dev server
npm run dev

# Expected output:
# Local: http://localhost:5173
```

---

## Step 5: Test the Flows (15 min)

### Test 1: Channel Partner Dashboard (3 min)

```
1. Open browser: http://localhost:5173
2. Login as: test.partner.wakad@kair.app / Test@123456
3. You should see:
   ✅ Header: "📍 Wakad Dark Store"
   ✅ Stats: "0 Received Today", "0 Pending", "₹0 Commission"
   ✅ "No orders at this location yet" message
   ✅ Three tabs: Today, History, Profile
   ✅ Profile shows location details
```

**Troubleshooting:**
- If blank screen: Check browser console for errors
- If 403 Forbidden: Check RLS policies in Supabase
- If route not found: Clear cache and refresh

---

### Test 2: Batch Rider Dashboard (3 min)

```
1. Sign out from partner account
2. Login as: test.batchrider@kair.app / Test@123456
3. You should see:
   ✅ Header: "🚐 Batch Collection"
   ✅ Stats: Partner count, order count
   ✅ Route tab with list of partners
   ✅ "Collected from this partner" buttons
   ✅ Deliveries tab for morning dispatch
```

---

### Test 3: Order Routing Flow (9 min)

This is the critical test. You'll need multiple login sessions.

**Setup: 3 Browser Tabs**

**Tab 1: Customer (Piyush)**
```
Login: piyushkocheta@gmail.com / [your-password]
Navigate to: Home → "Urgent Pickup"
Confirm address: Confirm the Wakad address
Wait for admin to assign rider...
```

**Tab 2: Admin (Snehal)**
```
Login: snehal.kankariya@gmail.com / [your-password]
Go to: Ops Dashboard
Find new order (KR-XXXX)
Click: Assign to rider → Select Paresh (evaan27kocheta@gmail.com)
Confirm assignment
```

**Tab 3: Rider (Paresh)**
```
Login: evaan27kocheta@gmail.com / [your-password]
You should see new order in "Pending" list
Click: "Mark as picked up"
You enter the "Item Entry" screen
Add items:
  • Wash & Fold × 1 = ₹49
  • Wash & Iron × 1 = ₹79
  Total: ₹128
Click: "Save items"
Expected behavior:
  ✅ Order auto-routed to Wakad partner
  ✅ Status changed to "at_channel_partner"
  ✅ Customer notified with partner name
```

**Tab 1 (Refresh) - Customer Notification**
```
Customer sees notification:
"🧺 Your items have been picked up!
2 items collected: 1× Wash & Fold, 1× Wash & Iron · 
Total ₹128 · Safely at Wakad Dark Store · 
Est. delivery [date]"
```

**Tab 4 (New) - Channel Partner View**
```
Login: test.partner.wakad@kair.app / Test@123456
Refresh dashboard
You should see:
  ✅ Order KR-XXXX appears in "Today's orders"
  ✅ Customer name: Piyush
  ✅ Items: 2 items
  ✅ Commission: ₹25
  ✅ Button: "Confirm Received"
Click "Confirm Received"
Expected:
  ✅ Status badge changes to "Received"
  ✅ Green checkmark shows
  ✅ Stats update
```

---

## Step 6: Production Deployment (1 min)

```bash
# All changes are already committed
git log --oneline -1

# Just push to trigger Vercel deployment
git push origin main

# Check deployment progress
# https://vercel.com/dashboard/deployments

# Live URL will be ready in ~2 minutes:
# https://kair-xi.vercel.app
```

---

## 🐛 Troubleshooting

### Issue: "Route not found" for /channel-partner

**Solution:**
- Clear browser cache: Ctrl+Shift+Delete
- Hard refresh: Ctrl+Shift+R
- Check imports in App.jsx are correct

```javascript
// Should have these imports:
import ChannelPartnerApp from './screens/ChannelPartnerScreens';
import BatchRiderApp from './screens/BatchRiderScreens';
```

### Issue: Orders not appearing in channel partner dashboard

**Solution - Check RLS Policies:**
```sql
-- Supabase SQL Editor
SELECT * FROM orders WHERE channel_partner_id IS NOT NULL;

-- Should show orders with at_channel_partner status
-- If empty, routing logic didn't execute
```

### Issue: Distance calculation returning NaN

**Solution - Verify coordinates:**
```sql
-- Check if addresses have lat/lng
SELECT id, flat_no, area, lat, lng FROM addresses LIMIT 5;

-- If NULL, update with sample coordinates
UPDATE addresses 
SET lat = 18.5912, lng = 73.7997 
WHERE area = 'Wakad';
```

### Issue: Commission not calculated

**Solution - Check commission_paise:**
```sql
-- Verify partner has commission rate
SELECT id, name, commission_paise FROM channel_partners;

-- Should show 2500 (₹25 per order)
-- If missing, update:
UPDATE channel_partners 
SET commission_paise = 2500 
WHERE id = 'cp-wakad-001';
```

---

## 📊 Key Files Modified

```
Total changes in Phase 2:
- 2 new screen components: ~600 LOC
- 1 routing utility: ~150 LOC
- 1 constants update: +25 LOC
- 1 migration file: ~90 LOC
- 2 documentation files: ~500 LOC

Total: ~1,350 lines of code + docs
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Channel Partner Dashboard loads
- [ ] Batch Rider Dashboard loads
- [ ] Order auto-routes to partner on rider confirmation
- [ ] Partner receives order in their dashboard
- [ ] Commission calculated correctly
- [ ] Status transitions work (picked_up → at_channel_partner → etc.)
- [ ] Notifications sent to partner
- [ ] Customer sees partner name in notification
- [ ] No console errors or RLS violations

---

## 🎯 Next: Phase 3 Preparation

After verification, next steps are:

1. **Ops Dashboard Enhancements** (4-5 hours)
   - Channel Partners tab
   - Batch Runs tab
   - Settlement dashboard

2. **Notification System** (2-3 hours)
   - Implement all 11 notification triggers
   - Real-time push notifications

3. **Commission & Settlement** (2-3 hours)
   - Auto-calculation on delivery
   - Partner payout system

---

## 📞 Support

If you encounter issues:

1. **Check logs:**
   ```bash
   # Browser console
   F12 → Console tab
   ```

2. **Check database:**
   ```bash
   # Supabase SQL Editor
   SELECT * FROM orders LIMIT 10;
   ```

3. **Check RLS policies:**
   ```bash
   # Supabase Auth → Policies
   # Verify channel_partner role can read/write orders
   ```

4. **Review recent commits:**
   ```bash
   git log --oneline -5
   git show <commit-hash>
   ```

---

## 🚀 Performance Notes

Expected performance after Phase 2:

- Dashboard load time: < 1s
- Order list fetch: < 500ms
- Routing assignment: < 2s
- Status update: < 500ms

Database queries are indexed for:
- channel_partner_id on orders
- partner_id on partner_transactions
- area on channel_partners

---

Generated: 2026-05-15
Version: 2.0
Status: ✅ Ready for Testing
