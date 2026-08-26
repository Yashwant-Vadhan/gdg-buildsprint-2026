# Campus Service Hub

A unified mobile-friendly platform for campus canteen ordering & queueing, hostel snack-store ordering, and hostel laundry management — built to cut waiting-room crowding, prevent overselling on limited stock, and give students a single wallet for hostel services.

Built in an 8-hour hackathon by **Yashwant**, **Sushil**, and **Madheshwaran**.

---

## Problem

Students lose time standing in canteen queues with no visibility into wait time, hostel snack-store stock runs out mid-queue with no live updates, and laundry status is opaque. This project gives every service a live queue, atomic stock handling (no double-selling the last item), a verifiable pickup flow, and a shared hostel wallet.

## Who uses this

| Role | Access |
|---|---|
| Day Scholar | Canteen only |
| Hosteller | Canteen + Hostel Store + Laundry, shared wallet |
| Canteen Admin | Manage canteen menu, verify pickups |
| Store Admin | Manage store stock, verify pickups |
| Laundry Admin | Manage laundry queue/status, verify pickups |
| Hostel Committee | Review semester fee receipts, approve one-time wallet credit |

## Core Features

- **Live queue & stock** — students see remaining quantity, people ahead of them, and an estimated **collect-by time** before and after ordering, so pickups spread out instead of clustering.
- **No overselling** — stock and wallet debits use atomic database operations, so two simultaneous orders on the last item can't both succeed.
- **UPI payments (Cashfree sandbox)** — canteen orders are paid via Cashfree's hosted UPI checkout.
- **Pickup QR verification** — every paid order gets a signed QR code; the service admin scans it to verify and release the order, so no one collects an order they didn't pay for.
- **Shared hostel wallet** — one balance for Hostel Store + Laundry (like a city transit card). Each semester, ₹2,000 (₹1,000 store + ₹1,000 laundry) is credited once, after a hostel-fee receipt is uploaded and approved by the Hostel Committee. Students can top up further afterward.
- **Transaction ledger** — every payment (canteen, wallet top-up, wallet debit, semester credit) is logged for admin turnover/invoice reporting.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + Tailwind CSS |
| Database / Auth / Realtime | Supabase (Postgres) |
| Payments | Cashfree Payment Gateway (sandbox, UPI) |
| QR generation & verification | Supabase Edge Functions (signed tokens) + `qrcode.react` + browser QR scanner |
| Hosting / Deployment | Firebase Hosting (Google) |

> See [`TECH_RULES.md`](./TECH_RULES.md) for the full architecture and rationale, [`PRD.md`](./PRD.md) for requirements and scope, [`DESIGN.md`](./DESIGN.md) for screens and UI, and [`todo.md`](./todo.md) for the step-by-step build order.

## Team & Roles

| Member | Owns |
|---|---|
| Yashwant | Database schema, Supabase Auth/RLS, atomic stock & wallet functions, QR signing, Cashfree server-side integration, Firebase Hosting deployment |
| Sushil | Student-facing frontend: canteen/store/laundry ordering, wallet, fee receipt upload, live status & QR display |
| Madheshwaran | Admin-facing frontend: menu/stock management, QR pickup scanner, Hostel Committee approval dashboard, payments/turnover view |

## Local Setup

```bash
git clone <repo-url>
cd campus-service-hub
npm install
cp .env.example .env   # fill in Supabase + Cashfree sandbox keys
npm run dev
```

## Status

Hackathon MVP — see [`PRD.md`](./PRD.md) §MVP Scope for what's built vs. scoped-for-later.

## License

MIT
