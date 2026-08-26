# todo.md — Campus Service Hub
> Generated from: PRD.md · DESIGN.md · TECH_RULES.md
> Target: MVP-first execution for AI coding agents (Cursor / Claude Code / Windsurf) — minimum back-and-forth, maximum specificity
> Team: Yashwant (Backend/DB), Sushil (Student Frontend), Madheshwaran (Admin Frontend + Payments/Committee)
> Timebox: 8 hours, review checkpoints assumed at Hour 3 and Hour 6 — adjust if actual timing differs

---

## Phase 1: Project Setup & Tooling
*Goal: Reproducible dev environment, repo structure, Supabase + Firebase projects created*

#### T1-001: Scaffold React app
**Description:** `npm create vite@latest campus-service-hub -- --template react`, add Tailwind CSS per Tailwind's Vite guide, create the folder structure from TECH_RULES.md §Folder Structure.
**Dependencies:** None
**Acceptance Criteria:**
- [ ] `npm run dev` serves a blank Tailwind-styled page
- [ ] `src/pages/{student,admin,committee}` directories exist
**Estimated Effort:** 20 min
**Assigned To:** Yashwant

#### T1-002: Create Supabase project and connect
**Description:** Create a Supabase project, copy URL + anon key into `.env` (and `.env.example` without real values), create `src/lib/supabaseClient.js` exporting a configured client.
**Dependencies:** None
**Acceptance Criteria:**
- [ ] `supabaseClient.js` exports a working client
- [ ] `.env.example` committed with placeholder keys only
**Estimated Effort:** 15 min
**Assigned To:** Yashwant

#### T1-003: Create Firebase project and Hosting config
**Description:** `firebase init hosting`, point public dir to `dist`, confirm `firebase deploy` publishes the placeholder Vite page.
**Dependencies:** T1-001
**Acceptance Criteria:**
- [ ] `firebase.json` committed
- [ ] A live Firebase Hosting URL shows the placeholder page
**Estimated Effort:** 20 min
**Assigned To:** Yashwant

#### T1-004: Set up Cashfree sandbox account
**Description:** Register/log into Cashfree sandbox dashboard, generate test `client_id`/`client_secret`, add to Edge Function env (not frontend `.env`).
**Dependencies:** None
**Acceptance Criteria:**
- [ ] Sandbox credentials obtained and stored in Supabase Edge Function secrets
**Estimated Effort:** 20 min
**Assigned To:** Madheshwaran

---

## Phase 2: Database & Data Layer
*Goal: Full schema, RLS, atomic RPC functions live in Supabase*

#### T2-001: Create core tables
**Description:** Run the full SQL from TECH_RULES.md §Database Schema (`users`, `wallets`, `wallet_semester_credits`, `fee_receipts`, `payments`, `canteen_items`, `canteen_orders`, `store_items`, `store_orders`, `laundry_services`, `laundry_orders`) as a Supabase migration.
**Dependencies:** T1-002
**Acceptance Criteria:**
- [ ] All tables exist in Supabase Table Editor
- [ ] Indexes from TECH_RULES.md created
**Estimated Effort:** 30 min
**Assigned To:** Yashwant

#### T2-002: Create atomic RPC functions
**Description:** Add `decrement_stock`, `debit_wallet`, `credit_wallet_once_per_semester` exactly as specified in TECH_RULES.md.
**Dependencies:** T2-001
**Acceptance Criteria:**
- [ ] All three functions callable via `supabase.rpc(...)`
- [ ] Manually test: calling `decrement_stock` on an item with qty=1 twice in parallel — only one call returns success
**Estimated Effort:** 30 min
**Assigned To:** Yashwant

#### T2-003: Row Level Security policies
**Description:** Enable RLS on every table. Students: read/write only rows where `user_id = auth.uid()`. Admins: read/write only their service's tables. Committee: read/write only `fee_receipts` and `wallet_semester_credits`.
**Dependencies:** T2-001
**Acceptance Criteria:**
- [ ] A student's Supabase client cannot read another student's orders (test manually)
- [ ] A canteen_admin cannot write to laundry_orders
**Estimated Effort:** 45 min
**Assigned To:** Yashwant

#### T2-004: Seed sample data
**Description:** Insert 5 canteen items, 5 store items, 4 laundry_services rows (one per service type) for demo purposes.
**Dependencies:** T2-001
**Acceptance Criteria:**
- [ ] Seed script or SQL insert committed to `supabase/migrations/`
**Estimated Effort:** 15 min
**Assigned To:** Yashwant

---

## Phase 3: Authentication & Authorization
*Goal: Login, signup, role-based routing*

#### T3-001: Signup/login screens
**Description:** Build `/login` using Supabase Auth email/password. On signup, insert a matching row into `users` (roll_no, user_type, role) and, if `user_type = hosteller`, auto-create a `wallets` row with balance 0.
**Dependencies:** T2-001, T1-001
**Acceptance Criteria:**
- [ ] New hosteller signup produces a `users` row and a `wallets` row with balance 0
- [ ] New day_scholar signup produces a `users` row and no wallet row
**Estimated Effort:** 45 min
**Assigned To:** Sushil

#### T3-002: Role-based route guarding
**Description:** In `routes.jsx`, redirect `day_scholar` away from `/student/store`, `/student/laundry`, `/student/wallet`; redirect non-admin roles away from `/admin/*`; redirect non-committee roles away from `/committee/*`.
**Dependencies:** T3-001
**Acceptance Criteria:**
- [ ] A day_scholar account visiting `/student/store` is redirected
**Estimated Effort:** 20 min
**Assigned To:** Sushil

---

## Phase 4: Core Backend — Canteen Order + Payment + QR (Must Have)
*Goal: The one flow that must work flawlessly live*

#### T4-001: `create-cashfree-order` Edge Function
**Description:** Given `{item_id, qty, user_id}`, validate item availability, call Cashfree Orders API (sandbox) to create an order and get a `payment_session_id`, insert a `payments` row with `status='pending'`, return `{payment_session_id, payments_id}` to the client.
**Dependencies:** T2-001, T1-004
**Acceptance Criteria:**
- [ ] Returns a valid `payment_session_id` from Cashfree sandbox
**Estimated Effort:** 60 min
**Assigned To:** Yashwant

#### T4-002: `cashfree-webhook` Edge Function
**Description:** Receive Cashfree's payment status webhook, verify its signature per Cashfree's webhook docs, on success: update the `payments` row to `status='success'`, call `decrement_stock('canteen_items', item_id, qty)`, insert the `canteen_orders` row (status `Received`, `estimated_ready_at` = now + prep_time_min × queue_position), call `generate-order-qr`.
**Dependencies:** T4-001, T2-002
**Acceptance Criteria:**
- [ ] A successful sandbox payment results in exactly one `canteen_orders` row
- [ ] A failed payment does not create an order or decrement stock
- [ ] ⚠️ UNCLEAR: exact webhook payload/signature header name — check Cashfree's current sandbox docs at build time
**Estimated Effort:** 60 min
**Assigned To:** Yashwant

#### T4-003: `generate-order-qr` Edge Function
**Description:** Given an order id + service, build payload `{order_id, service, user_roll_no, amount, issued_at}`, sign with HMAC-SHA256 using a secret from env, store the payload+signature on the order row, return the signed string for QR rendering.
**Dependencies:** T2-001
**Acceptance Criteria:**
- [ ] Returned string decodes to the correct payload and a valid signature
**Estimated Effort:** 30 min
**Assigned To:** Yashwant

#### T4-004: `verify-order-qr` Edge Function
**Description:** Given a scanned QR string + order table name, re-verify the HMAC signature, fetch the order, reject if signature invalid, reject if already `Collected`/`Delivered`, otherwise update status and set `collected_at`/`delivered_at`.
**Dependencies:** T4-003
**Acceptance Criteria:**
- [ ] Tampered payload is rejected
- [ ] Re-scanning an already-collected order returns "already collected" without re-processing
**Estimated Effort:** 30 min
**Assigned To:** Yashwant

---

## Phase 5: Core Frontend — Canteen (Must Have)
*Goal: Student and admin canteen screens, live and working*

#### T5-001: Canteen menu screen (student)
**Description:** `src/pages/student/Canteen.jsx` — fetch `canteen_items` where `is_available=true`, display per DESIGN.md item card spec, show live queue length (count of orders not in `Collected`), subscribe to realtime changes on `canteen_items` and `canteen_orders`.
**Dependencies:** T2-004, T3-001
**Acceptance Criteria:**
- [ ] Stock count updates live in a second browser tab when another tab orders
**Estimated Effort:** 60 min
**Assigned To:** Sushil

#### T5-002: Checkout + Cashfree trigger (student)
**Description:** On "Pay with UPI", call `create-cashfree-order`, then open Cashfree's JS SDK checkout modal in sandbox mode with the returned `payment_session_id`.
**Dependencies:** T4-001
**Acceptance Criteria:**
- [ ] Sandbox UPI checkout modal opens and completes a test payment
**Estimated Effort:** 45 min
**Assigned To:** Sushil

#### T5-003: Order status + QR screen (student)
**Description:** Poll/subscribe to the created `canteen_orders` row, render the status stepper, the "Collect by HH:MM" callout from `estimated_ready_at`, and the QR (via `qrcode.react`) from the signed string returned by `generate-order-qr`.
**Dependencies:** T4-003, T5-002
**Acceptance Criteria:**
- [ ] Status updates live when admin advances it (Phase 5 admin side)
**Estimated Effort:** 45 min
**Assigned To:** Sushil

#### T5-004: Admin canteen menu CRUD
**Description:** `src/pages/admin/CanteenMenu.jsx` — list/add/edit `canteen_items` (name, price, qty, prep_time_min, daily_limit, is_available toggle).
**Dependencies:** T2-004
**Acceptance Criteria:**
- [ ] Editing quantity in admin view reflects live on the student menu screen
**Estimated Effort:** 45 min
**Assigned To:** Madheshwaran

#### T5-005: Admin order queue + status advance
**Description:** `src/pages/admin/CanteenQueue.jsx` — realtime list of `canteen_orders`, buttons to advance status Received→Preparing→Ready.
**Dependencies:** T4-002
**Acceptance Criteria:**
- [ ] Advancing status here updates the student's live view (T5-003) without refresh
**Estimated Effort:** 30 min
**Assigned To:** Madheshwaran

#### T5-006: Admin QR scanner
**Description:** Integrate a browser QR-scan library (e.g. `html5-qrcode`), on scan call `verify-order-qr`, show success/error banner per DESIGN.md.
**Dependencies:** T4-004
**Acceptance Criteria:**
- [ ] Scanning a valid QR marks the order `Collected` and shows a success banner
- [ ] Scanning it again shows "already collected"
**Estimated Effort:** 45 min
**Assigned To:** Madheshwaran

---

### 🔴 Review 1 Checkpoint (Hour 3 target)
Demo: place a canteen order, pay via Cashfree sandbox UPI, show the QR + collect-by time, scan it from the admin screen, and demonstrate two simultaneous orders on a 1-qty item where only one succeeds.

---

## Phase 6: Wallet, Hostel Store, Laundry (Should Have)

#### T6-001: Fee receipt upload (student)
**Description:** `src/pages/student/Wallet.jsx` — file upload to Supabase Storage, insert `fee_receipts` row (`status='pending'`) with the storage URL and selected semester.
**Dependencies:** T2-001, T3-001
**Acceptance Criteria:**
- [ ] Re-uploading for an already-credited semester is blocked client-side with a clear message
**Estimated Effort:** 40 min
**Assigned To:** Sushil

#### T6-002: Committee receipt review screen
**Description:** `src/pages/committee/Receipts.jsx` — realtime list of `pending` `fee_receipts`, Approve calls `credit_wallet_once_per_semester` RPC, Reject sets `status='rejected'`.
**Dependencies:** T2-002, T6-001
**Acceptance Criteria:**
- [ ] Double-clicking Approve does not double-credit (RPC's unique constraint enforces this — verify the UI also disables the button after first click)
**Estimated Effort:** 40 min
**Assigned To:** Madheshwaran

#### T6-003: Wallet balance display + transaction history
**Description:** Show current `wallets.balance` and a list from `payments` where `user_id = current user`.
**Dependencies:** T2-001
**Acceptance Criteria:**
- [ ] Balance updates live after a committee approval or a service debit
**Estimated Effort:** 30 min
**Assigned To:** Sushil

#### T6-004: Hostel Store order flow (student + admin)
**Description:** Mirror T5-001/T5-004/T5-005/T5-006 for `store_items`/`store_orders`, but debit via `debit_wallet` RPC instead of Cashfree.
**Dependencies:** T2-002, T5-001 through T5-006 (reuse components)
**Acceptance Criteria:**
- [ ] Order blocked with a clear "insufficient balance" message if wallet balance too low
**Estimated Effort:** 60 min
**Assigned To:** Sushil (student side), Madheshwaran (admin side)

#### T6-005: Laundry request + status flow (student + admin)
**Description:** Student selects a `laundry_services` row, confirms, wallet-debited, order created with status `Registered`; admin advances through Registered→Collected→Washing→(Drying)→(Ironing)→Ready→Delivered, skipping Drying/Ironing in the UI for `wash_only`.
**Dependencies:** T2-002
**Acceptance Criteria:**
- [ ] `wash_only` orders skip Drying/Ironing steps in both student and admin views
**Estimated Effort:** 60 min
**Assigned To:** Sushil (student side), Madheshwaran (admin side)

#### T6-006: Payments turnover view (admin)
**Description:** `src/pages/admin/Payments.jsx` — aggregate `payments` by month and service (`sum(amount) group by date_trunc('month', created_at), service`), display as a table.
**Dependencies:** T2-001
**Acceptance Criteria:**
- [ ] Table reflects all canteen + wallet + fee-credit payments recorded so far
**Estimated Effort:** 30 min
**Assigned To:** Madheshwaran

---

### 🔴 Review 2 Checkpoint (Hour 6 target)
Demo: hosteller uploads a receipt → committee approves → wallet credited → student buys a store item and registers laundry from the same wallet → admin views turnover table.

---

## Phase 7: Nice to Have (only if ahead of schedule)

#### T7-001: Self-service wallet top-up via Cashfree
**Description:** Reuse T4-001/T4-002 pattern with `service='wallet_topup'`; on webhook success, credit wallet via a simple `update wallets set balance = balance + amount` (not semester-limited).
**Dependencies:** T4-001, T4-002
**Estimated Effort:** 45 min
**Assigned To:** Yashwant + Madheshwaran

#### T7-002: Printable monthly invoice view
**Description:** A print-friendly `/admin/payments/invoice?month=YYYY-MM` route using browser print-to-PDF (no PDF library needed).
**Dependencies:** T6-006
**Estimated Effort:** 30 min
**Assigned To:** Madheshwaran

#### T7-003: Peak-hour analytics
**Description:** Simple bar chart (orders per hour) from `canteen_orders.ordered_at` grouped by hour.
**Dependencies:** T6-006
**Estimated Effort:** 30 min
**Assigned To:** Madheshwaran

---

## Phase 8: Deployment

#### T8-001: Production build + Firebase deploy
**Description:** `npm run build`, `firebase deploy`, confirm the live Firebase Hosting URL works end-to-end against the real Supabase project.
**Dependencies:** All above must-have/should-have phases
**Acceptance Criteria:**
- [ ] Full canteen flow works on the deployed URL, not just localhost
**Estimated Effort:** 20 min
**Assigned To:** Yashwant

---

## Appendix

### Critical Path
1. T1-002 (Supabase connected) → T2-001 (schema) → T2-002 (atomic RPCs) → T4-001/T4-002 (payment+order creation) → T5-001/T5-002/T5-003 (student canteen UI) → T5-004/T5-005/T5-006 (admin canteen UI) → **Review 1**
2. T6-001/T6-002 (wallet credit flow) → T6-004/T6-005 (store + laundry) → T6-006 (turnover) → **Review 2**

### Parallelizable Tasks
- T1-001 (Sushil-consumed scaffold) and T1-002/T1-004 (Yashwant/Madheshwaran) run simultaneously.
- Once T2-002 lands, T5-001/T5-002/T5-003 (Sushil) and T5-004/T5-005/T5-006 (Madheshwaran) run fully in parallel.
- T6-001 (Sushil) and T6-002 (Madheshwaran) can start in parallel once T2-002 exists — they meet at the RPC call, not before.

### Risk Register
| Risk | Affected Tasks | Likelihood | Mitigation |
|---|---|---|---|
| Cashfree sandbox webhook signature/format differs from what's assumed here | T4-002 | Medium | Check Cashfree's current sandbox docs before starting T4-002, budget 15 extra min |
| QR camera scanning flaky on demo device/lighting | T5-006 | Medium | Test on the actual demo phone at Hour 5, not just a laptop webcam |
| Supabase Realtime connection drops on venue wifi | T5-001, T5-003, T5-005 | Low–Medium | Add a manual "refresh" fallback button on every realtime-dependent screen |
| Google-tooling requirement meant Firestore, not just Hosting | Whole DB layer | Low but high-impact | Confirm interpretation with team/organizers in the first 15 minutes |

### Recommended Build Order
1. Phase 1 (all three, parallel) — 1 hour
2. Phase 2 (Yashwant) while Phase 3 (Sushil) starts in parallel once T1-001 lands
3. Phase 4 (Yashwant) while Phase 5 UI shells (Sushil, Madheshwaran) are scaffolded against seed data
4. Wire Phase 5 to Phase 4 as each Edge Function lands — **Review 1**
5. Phase 6 (all three, split as tagged) — **Review 2**
6. Phase 7 only if time remains, Phase 8 last
