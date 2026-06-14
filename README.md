# Nexton Lubricants CRM

A CRM for Nexton Lubricants to manage daily leads, follow-up calls, sample/catalogue
tracking, distributor conversion, reporting, and automated WhatsApp messaging.

## Monorepo layout

```
crm/
├── frontend/   # Next.js app (deployed as its own Vercel project)
└── backend/    # Node/Express + MongoDB API (deployed as its own Vercel project)
```

## Branches
- `main` — production (auto-deploys to Vercel)
- `development` — active development

## Tech stack
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, Mongoose (MongoDB Atlas)
- **Auth:** JWT, roles: `employee` / `admin`
- **Messaging:** WhatsApp (pluggable provider — Meta Cloud API / Twilio / Interakt)

## Core features
- Daily lead entry (mobile, address, state) — current-date only, **no back-dated leads**
- Follow-up scheduling — each employee sees their due follow-ups day by day
- Every follow-up records an outcome + the development that occurred
- Outcomes: no pickup · high rate · no capacity · retail enquiry · **converted to distributor**
- One-time catalogue & sample tracking (with sent date) + sample request description
- Daily edit lock — an employee edits a day's work only until the day ends
- Admin panel + reports (calls, no-pickup, no-capacity, high-rate, conversions, order value)
- Auto WhatsApp message on the 2nd follow-up (one time) — heading, catalogue link, product photo

## Local development
See `backend/README` notes and `frontend/` for run instructions. Each app has a
`.env.example` listing required variables.
