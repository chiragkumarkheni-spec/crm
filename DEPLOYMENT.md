# Deployment & setup guide — Nexton Lubricants CRM

Three accounts do the "live" part: **GitHub** (code), **MongoDB Atlas** (database),
**Vercel** (hosting). You'll click through these in the browser; the steps below are
exact. Everything in code is already done.

---

## 1. MongoDB Atlas (database)

1. Go to https://cloud.mongodb.com → create a **free M0 cluster**.
2. **Database Access** → add a database user (username + password). Save them.
3. **Network Access** → Add IP Address → **Allow access from anywhere** (`0.0.0.0/0`)
   (Vercel uses dynamic IPs, so this is required).
4. **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Add the database name `nexton_crm` before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/nexton_crm?retryWrites=true&w=majority
   ```
   This is your **`MONGODB_URI`**.

---

## 2. GitHub (push the code)

In the browser: create a new **empty** repo named **`crm`** (no README/license).
Then copy its URL and tell me, or run these yourself from the project root:

```bash
git remote add origin https://github.com/<your-username>/crm.git
git push -u origin main
git push -u origin development
```

`main` = production, `development` = active work.

---

## 3. Vercel — TWO projects from the one repo

In Vercel, **Add New… → Project → import the `crm` repo** twice — once per app.

### Project A — Backend (API)
- **Root Directory:** `backend`
- **Framework Preset:** Other
- **Environment Variables** (Settings → Environment Variables):
  | Key | Value |
  |-----|-------|
  | `MONGODB_URI` | (from step 1) |
  | `JWT_SECRET` | a long random string |
  | `JWT_EXPIRES_IN` | `7d` |
  | `CLIENT_ORIGIN` | your frontend URL (fill after Project B, e.g. `https://nexton-crm.vercel.app`) |
  | `WHATSAPP_PROVIDER` | `stub` (until WhatsApp is set up) |
  | `TZ` | `Asia/Kolkata` |
- Deploy. Note the URL, e.g. `https://nexton-crm-backend.vercel.app`.
- Test it: open `https://<backend-url>/api/health` → should return `{ "status": "ok" }`.

### Project B — Frontend (Next.js)
- **Root Directory:** `frontend`
- **Framework Preset:** Next.js (auto-detected)
- **Environment Variable:**
  | Key | Value |
  |-----|-------|
  | `NEXT_PUBLIC_API_URL` | the backend URL from Project A |
- Deploy. Note the URL — that's the app your team uses.

> After Project B is live, set Project A's `CLIENT_ORIGIN` to the Project B URL and redeploy
> the backend (so CORS allows the frontend).

Both projects auto-deploy when you push to `main`.

---

## 4. Create the first admin user

After the backend is live and `MONGODB_URI` is set, run the seed once from the
`backend` folder locally (with the same `MONGODB_URI` in `backend/.env`):

```bash
cd backend
npm run seed
```

Default admin (override via env): `admin@nexton.com` / `changeme123`.
Log in, then add employees from the **Admin** page.

---

## 5. Local development

```bash
# Terminal 1 — backend
cd backend
cp .env.example .env        # then fill MONGODB_URI + JWT_SECRET
npm run dev                 # http://localhost:5000

# Terminal 2 — frontend
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:5000
npm run dev                 # http://localhost:3000
```

---

## 6. WhatsApp (later)

The auto-message on the 2nd follow-up is built behind a provider interface
(`backend/src/services/whatsapp.js`). To go live:
- Set `WHATSAPP_PROVIDER=meta` (or `twilio`) and the matching env vars.
- For Meta: create a Meta Business account, get a phone number ID + access token,
  and create an approved template (heading + catalogue link + product image).
- Set `WHATSAPP_CATALOGUE_URL` and `WHATSAPP_PRODUCT_IMAGE_URL`.

Until then `WHATSAPP_PROVIDER=stub` just logs the message (no real send), so the
rest of the CRM works end-to-end.
