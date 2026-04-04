# Kair — Deployment Guide

## Architecture
```
Vercel (customer-app)  ──┐
Vercel (rider-app)     ──┼──► Railway (backend API) ──► Supabase (DB + Auth)
                         │                          ──► Razorpay (payments)
```

---

## 1. Deploy Backend on Railway

1. Push the `backend/` folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set environment variables in Railway dashboard:
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   RAZORPAY_KEY_ID=...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=...
   FRONTEND_URL=https://your-app.vercel.app
   NODE_ENV=production
   ```
4. Railway auto-detects Node.js and runs `npm start`
5. Copy the Railway URL (e.g. `https://kair-backend.railway.app`)

---

## 2. Configure Razorpay Webhook

1. Go to Razorpay Dashboard → Settings → Webhooks → Add New Webhook
2. URL: `https://kair-backend.railway.app/api/payments/webhook`
3. Events to enable:
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
4. Copy the webhook secret → set as `RAZORPAY_WEBHOOK_SECRET` in Railway

---

## 3. Deploy Customer App on Vercel

1. Push `customer-app/` to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Framework: Vite
4. Set environment variables:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   VITE_API_URL=https://kair-backend.railway.app
   VITE_RAZORPAY_KEY_ID=rzp_live_XXXX        ← use live key in production
   VITE_APP_NAME=Kair
   VITE_APP_CITY=Pune
   ```
5. Deploy → get URL like `https://kair.vercel.app`

---

## 4. Deploy Rider App on Vercel

Same as customer app but for `rider-app/` folder.
Set same `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`.

---

## 5. Configure Supabase Phone Auth (OTP)

1. Go to Supabase Dashboard → Authentication → Providers → Phone
2. Enable Phone provider
3. Add Twilio credentials:
   - Account SID
   - Auth Token
   - Messaging Service SID (or From number)
4. In Auth → Settings → set your Vercel URLs as allowed redirect URLs

---

## 6. Switch Razorpay to Live Mode

When ready to go live in Pune:
1. Complete Razorpay KYC (business verification)
2. Generate Live API keys in Razorpay dashboard
3. Update `VITE_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_ID/SECRET` on Vercel & Railway
4. Update webhook URL with live secret

---

## 7. Create First Admin & Rider Accounts

After deploying, set role in Supabase:
```sql
-- In Supabase SQL Editor

-- Make a user an admin
UPDATE profiles SET role = 'admin' WHERE phone = '+919876543210';

-- Make a user a rider (Raju Patil)
UPDATE profiles SET role = 'rider', full_name = 'Raju Patil', area = 'Koregaon Park'
WHERE phone = '+919822034567';
```

---

## 8. Test Razorpay in Staging

Use these test credentials:
- Card: `4111 1111 1111 1111` · Expiry: any future date · CVV: any
- UPI:  `success@razorpay`
- UPI fail: `failure@razorpay`

---

## 📱 Make it a PWA (optional next step)

Add a `vite-plugin-pwa` to both apps so customers can install Kair
on their home screen like a native app:

```bash
npm install -D vite-plugin-pwa
```

Then in `vite.config.js`:
```js
import { VitePWA } from 'vite-plugin-pwa';
export default { plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Kair', short_name: 'Kair', theme_color: '#FF6B00' } })] };
```
