# PRD — Campus Service Hub

## Executive Summary
- **Project Name:** Campus Service Hub
- **Problem Statement:** Students face long, opaque queues at the canteen, uncertain stock at the hostel snack store, and no visibility into laundry turnaround — leading to overcrowding, wasted time, and disputes over who's next or whether an item is still available.
- **Solution Overview:** One mobile-friendly platform covering canteen ordering (all students), hostel store ordering, and laundry management (hostellers only), with live queue/stock visibility, UPI payment, QR-verified pickup, and a shared hostel wallet.
- **Target Audience:** College students (day scholars and hostellers) and the staff/committee who run each service.

## Goals & Objectives

### Business Goals
- Reduce canteen/store overcrowding and queue disputes.
- Eliminate overselling of limited-stock items.
- Give hostel administration an auditable record of wallet credits and service revenue.

### User Goals
- Know exactly when to show up to collect an order.
- Trust that a scanned QR is the only way to release a paid order.
- Manage one wallet balance instead of separate store/laundry balances.

### Success Metrics (for the demo, not production KPIs)
- A concurrent double-order on a last-stock item: exactly one succeeds.
- End-to-end time from order placement to QR-verified collection is demoable live.
- Wallet balance updates correctly across a fee-receipt approval, a self-recharge, and a service debit.

## User Personas

**Day Scholar (student)** — Only needs the canteen. Pain point: doesn't know how long the queue is before leaving class. Goal: order ahead, know when to arrive, pay by UPI.

**Hosteller (student)** — Uses canteen, hostel store, and laundry. Pain point: three different balances/queues to track. Goal: one wallet, clear status across all three services.

**Canteen / Store / Laundry Admin** — Runs day-to-day operations for their service. Pain point: manually tracking who paid for what invites disputes. Goal: scan a QR, see it's valid, release the item — no manual lookup.

**Hostel Committee Member** — Verifies each hosteller's semester fee payment before their wallet gets the once-a-semester credit. Pain point: no current way to track who's been credited already. Goal: a simple approve/reject queue with no double-credits possible.

## User Stories

**Canteen (all students)**
- As a student, I want to see the live menu, remaining quantity, and queue length, so I can decide whether to order now.
- As a student, I want to pay via UPI (Cashfree) when I place an order, so payment is settled immediately.
- As a student, I want a QR code and an estimated "collect by" time after paying, so I know when to show up and can prove I paid.
- As a canteen admin, I want to scan a student's QR to verify payment and mark the order collected, so I never hand out an unpaid order.

**Hostel Store & Laundry (hostellers only)**
- As a hosteller, I want to pay from a single wallet for both store and laundry, so I don't manage two balances.
- As a hosteller, I want my ₹2,000 semester hostel-fee credit added automatically once I upload my receipt and the committee approves it, so I don't have to top up manually at the start of term.
- As a hosteller, I want to top up my wallet further if needed, so I'm not blocked once the semester credit is used.
- As a hosteller, I want to register a laundry request, pick a service type, and track its status, so I know when it's ready.
- As a hostel committee member, I want a queue of pending fee receipts to approve or reject, so credits only go out once verified, and never twice for the same semester.

## Functional Requirements

### Module: Auth & Roles
- **Description:** Email/roll-number based login via Supabase Auth. Each user has exactly one `user_type` (`day_scholar` | `hosteller`) and one `role` (`student` | `canteen_admin` | `store_admin` | `laundry_admin` | `hostel_committee`).
- **Validation:** Day scholars are blocked at the route/RLS level from hostel store and laundry endpoints.
- **Edge cases:** A hosteller with no wallet row yet (first login) — auto-create wallet with balance 0 on signup.

### Module: Canteen
- **Inputs:** Item selection, quantity, UPI payment via Cashfree.
- **Outputs:** Order token, estimated collect-by time, signed QR.
- **User Actions:** Browse menu → add to order → pay via Cashfree checkout → receive token + QR + collect-by time → track status live.
- **Validation:** Order blocked if `quantity_available < requested_qty` (checked atomically at write time, not just at read time).
- **Edge Cases:** Two students order the last unit simultaneously — exactly one write succeeds, the other gets an "out of stock, please retry" response. Payment succeeds but network drops before order confirmation renders — order must already exist server-side (created before/at payment success callback) so a page refresh shows the correct state.

### Module: Hostel Store
- Same order/stock pattern as Canteen, restricted to `user_type = hosteller`, paid from wallet balance (atomic debit) instead of direct UPI.

### Module: Laundry
- **Inputs:** Service type (`wash_only` | `wash_dry` | `wash_dry_iron` | `iron_only`).
- **Outputs:** Estimated completion time, status progression, QR for delivery verification.
- **Status flow:** Registered → Collected → Washing → Drying → Ironing → Ready → Delivered. (Skip Drying/Ironing sub-states in the UI when the chosen service doesn't include them — e.g. `wash_only` goes Registered → Collected → Washing → Ready → Delivered.)
- Paid from wallet balance (atomic debit).

### Module: Wallet & Semester Credit
- **Description:** One balance per hosteller, shared across Store and Laundry.
- **Semester credit flow:** Student uploads a fee receipt (image/PDF) tagged with a semester identifier → status `pending` → appears in Hostel Committee's review queue (realtime) → committee approves or rejects → on approval, ₹2,000 is credited to the wallet exactly once per (student, semester) pair, enforced by a unique constraint — a second upload for the same semester cannot trigger a second credit.
- **Self-recharge:** After the semester credit (or independently of it), a student can top up the wallet further via Cashfree UPI.
- **Validation:** Wallet debits for Store/Laundry fail atomically if `balance < amount` — no negative balances.

### Module: QR Pickup Verification
- **Description:** On successful payment/order creation, the server generates a signed token (order ID + service + amount + issued time, HMAC-signed) and the student's screen renders it as a QR.
- **Admin side:** Scans QR with device camera → server verifies the signature and current order status → if valid and not already collected, marks it `Collected`/`Delivered` and timestamps it.
- **Edge Cases:** Expired/tampered QR (bad signature) → reject with a clear error, do not mark collected. Already-collected order scanned again → reject with "already collected at [time]", do not double-process.

### Module: Payments Ledger & Reporting
- **Description:** Every money movement (canteen UPI payment, wallet top-up, wallet debit, semester credit) is written to a single `payments` table with service, amount, method, and status.
- **Admin use:** Aggregate by month and by service to show turnover; exportable as a simple table/CSV for "invoice" purposes (a full formatted PDF invoice is a stretch goal, not core).

## Non-Functional Requirements (scoped for a hackathon demo, not production)
- **Performance:** Order and payment actions should respond within a couple of seconds on demo wifi.
- **Security:** No hardcoded secrets (Cashfree keys, QR signing secret in env vars only); QR tokens must be signed server-side, never trust a client-supplied "verified" flag; RLS enforced so students can't read/write other students' orders or wallets.
- **Reliability:** Stock and wallet operations must be atomic — this is the one non-functional requirement that isn't optional even under time pressure.
- **Accessibility / Mobile:** Mobile-first responsive layout; not targeting a specific WCAG level given the timebox.

## Assumptions & Constraints
- Canteen payment is Cashfree UPI (sandbox) for every student, regardless of day scholar/hosteller status — no cash/COD fallback, per explicit requirement.
- "Google tools for deployment" is interpreted as: frontend hosted on **Firebase Hosting**. The database/auth/realtime layer remains **Supabase (Postgres)** because it gives atomic-transaction guarantees and built-in realtime that a from-scratch Google Cloud build can't match in this timebox. If this interpretation is wrong — i.e. the whole backend must be Google-native (Firestore/Cloud Functions) — that's a bigger rework and should be flagged to the team immediately, not discovered at Hour 5.
- Formatted PDF invoices are out of scope for the hackathon; a tabular monthly summary satisfies the "check turnover" requirement.
- Hostel Committee approval of fee receipts is manual (a human clicks approve/reject) — no automated receipt OCR/verification in this timebox.

## MVP Scope

### Must Have (target: working by Review 1)
- Auth + roles + route/RLS restrictions (day scholar vs hosteller)
- Canteen: menu, live stock/queue view, order placement, Cashfree UPI sandbox payment, atomic stock decrement, order status flow, collect-by time estimate, QR generation
- Canteen admin: menu CRUD, QR scan-to-verify → mark Collected

### Should Have (target: working by Review 2)
- Hostel wallet: balance display, fee-receipt upload, Hostel Committee approval queue, one-time-per-semester ₹2,000 credit (atomic/idempotent)
- Hostel Store ordering (wallet debit, same QR pattern)
- Laundry request + status tracking + QR (wallet debit)
- Payments ledger populated by all of the above, with a basic admin turnover-by-service view

### Nice to Have (only if ahead of schedule)
- Self-service wallet top-up via Cashfree UPI
- Printable/exportable monthly invoice view
- Analytics (peak hours, orders/day)
- In-app notifications beyond a status page (e.g. a banner when laundry becomes Ready)

### Explicitly Cut
- SMS/push notifications
- Payment retries/refund flows
- Receipt OCR or automated fraud checks on uploaded fee receipts
- Horizontal scaling, caching layer — mention as designed-for if asked, not built

## Future Enhancements
- Automated fee-receipt verification against a hostel-office system
- Real invoice PDF generation with GST-style line items
- Push notifications for order/laundry status changes
