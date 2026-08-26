# Campus Service Hub — Build Report

> Written from Madheshwaran's side (Admin/Committee frontend track). Covers everything
> done in this build session, start to end: what was built, what broke, what got fixed,
> and what's left. Team roles per `README.md`: Yashwant (DB/Auth/Backend), Sushil
> (Student frontend), Madheshwaran (Admin/Committee frontend + Payments).

---

## 1. How it works (architecture)

**Stack:** React (Vite) frontend talking directly to Supabase (Postgres + Auth +
Realtime + Edge Functions) from the browser — no custom backend server. Firebase
Hosting serves the built frontend; Supabase is the only backend.

**The three services, one pattern:** Canteen, Hostel Store, and Laundry all follow the
same shape — browse → order → pay (UPI for Canteen, wallet debit for Store/Laundry) →
get a signed QR → admin scans it to release the order. Stock and wallet balance
changes go through atomic Postgres RPC functions (`decrement_stock`, `debit_wallet`)
so two simultaneous orders on the last item can't both succeed — one gets
`out_of_stock`, the other wins.

**Auth → role, step by step:**
1. `auth.users` (Supabase Auth) handles login/session only — no role info lives here.
2. `public.users` is a separate table, same `id` (UUID) as `auth.users`, holding
   `role` (`student` / `canteen_admin` / `store_admin` / `laundry_admin` /
   `hostel_committee`) and `user_type` (`day_scholar` / `hosteller`).
3. On login, the app fetches the `public.users` row and merges it onto the auth user
   object — `user.role` and `user.user_type` are available everywhere after that.
4. `routes.jsx` reads `user.role` to decide where to send someone (`StudentGuard` for
   students, `StaffGuard` for the four admin/committee roles) and which nav tabs to
   show.
5. **The frontend routing is just convenience — the database enforces it for real.**
   Every table has Row Level Security keyed off `get_my_role()` / `get_my_user_type()`
   (Postgres functions reading the caller's own `public.users` row). A student's
   client literally cannot read another student's orders or write to an admin-only
   table, regardless of what the UI does.
6. Nobody can self-register as an admin — signup always hardcodes `role: 'student'`.
   Admin/committee accounts are provisioned manually (SQL/dashboard), not through a
   public form.

**QR pickup verification:** after payment, `generate-order-qr` (Edge Function) signs
`{order_id, service, user_roll_no, amount, issued_at}` with HMAC-SHA256 and stores it
on the order row. The admin's camera scan sends the decoded string + which orders
table to check to `verify-order-qr`, which re-verifies the signature server-side
(never trusts the client), checks the order isn't already collected, and flips its
status. A tampered or already-used QR is rejected with a specific reason, never marked
collected twice.

**Wallet & semester credit:** one balance per hosteller, shared by Store and Laundry.
A student uploads a fee receipt → Hostel Committee approves it → an RPC
(`credit_wallet_once_per_semester`) adds ₹2,000, enforced idempotent by a
`unique(user_id, semester)` constraint — re-uploading for an already-credited semester
can't trigger a second credit even if someone tries.

**Folder layout:**
```
campus-service-hub/        ← the actual app (Vite + React 19 + Tailwind v4)
  src/
    pages/student/         ← Sushil's track
    pages/admin/            ← this track
    pages/committee/        ← this track
    components/             ← StudentLayout, AdminLayout, shared UI
    hooks/useAuth.jsx       ← auth context, shared by everyone
    lib/                    ← supabaseClient, adminTheme
supabase/
  migrations/               ← Yashwant's schema/RPC/RLS/seed SQL (001-004)
  functions/                ← Edge Functions (Cashfree, QR sign/verify)
docs/                       ← this file + PRD/DESIGN/TECH_RULES/todo
```

---

## 2. Starting point

The repo (`gdg-buildsprint-2026`) contained only the `docs/` spec — `README.md`,
`PRD.md`, `DESIGN.md`, `TECH_RULES.md` — no application code, no `todo.md` (it's
gitignored per-teammate, so each person keeps their own local copy; none existed in
this checkout). No Supabase project was connected yet.

## 3. Phase 1 — Solo bootstrap (before the team's work was visible)

With nothing else in the repo yet, a full app scaffold was built from scratch at the
**repo root** so the admin/committee work had somewhere to live:

- Vite + React 18 + Tailwind CSS v3, `react-router-dom` v6
- `src/lib/supabaseClient.js`, `src/hooks/useAuth.js` (auth + `users` profile join),
  `src/hooks/useRealtimeOrders.js`
- Shared UI: `Button`, `Card`, `Badge`, `Modal`, `QRScanner`, `Skeleton`, `Toast`
- `Login.jsx` and `Register.jsx` (student self-signup, auto-creates a wallet for
  hostellers, hardcodes `role: 'student'` — no self-service admin signup, by design)
- Admin pages: `CanteenAdmin`, `StoreAdmin` (sharing one config-driven
  `ServiceAdminPage` since the DESIGN doc specifies they're structurally identical),
  `LaundryAdmin` (separate — different status flow per service type), `PaymentsView`
  (turnover-by-service table)
- Committee pages: `ReceiptsQueue` (approve/reject fee receipts, triggers the
  once-per-semester wallet credit RPC), `WalletLog` (credit history)
- `supabase/migrations/0001_init.sql` — the full schema + 3 atomic RPC functions
  (`decrement_stock`, `debit_wallet`, `credit_wallet_once_per_semester`), transcribed
  verbatim from `TECH_RULES.md` so there was something to build against

Verified at this stage with `npm run build` / `npm run dev`, and a temporary
`/dev/admin/*` bypass route (removed later) so screens could be previewed without a
real login.

## 4. Phase 2 — Connecting a real Supabase project

The user created a Supabase project (`ozfpxfhnzewhfzanhfvd`, org "Madras Institute of
Technology"). Key steps:

- Real keys initially landed in the **tracked** `.env.example` by mistake — caught and
  moved into the **gitignored** `.env` before anything got committed.
- The Supabase direct DB hostname (`db.<ref>.supabase.co:5432`) didn't resolve from
  this environment; the **session pooler** host (`aws-0-<region>.pooler.supabase.com`)
  worked and was used for all migration/seeding work.
- Ran `0001_init.sql` against the live project — all 11 tables + RPCs created.
- Seeded a `canteen_admin` test account directly via SQL (the public signup endpoint
  hit Supabase's email rate limit from earlier test signups): created the `auth.users`
  + `auth.identities` rows by hand (verified against the real Supabase Auth schema
  first), manually set `email_confirmed_at`, then inserted the matching
  `public.users` row with `role = canteen_admin`.
  - **Credentials:** `canteen.admin@campus.test` / `CanteenAdmin123!`
- End-to-end verified: login → real `/admin/canteen` → added a menu item → confirmed
  it wrote to the database → cleaned up the test row.

## 5. Phase 3 — UI pass on Canteen admin

Enhanced the (at-the-time root-level) Canteen admin screen:

- Stats bar (Active Orders / Ready Now / Low Stock)
- Kanban-style queue (Received / Preparing / Ready columns) with live elapsed time
  ("5m ago") and an overdue highlight past `estimated_ready_at`
- Menu cards: low-stock / out-of-stock badges, inline price+qty edit
- Skeleton loaders instead of "Loading…" text; toast notifications on add/update

## 6. Phase 4 — Discovering the team had pushed real work

Yashwant and Sushil had pushed to `origin/main` in the meantime. Pulling revealed a
**structural conflict**: they had scaffolded their own app inside a
**`campus-service-hub/` subfolder** (matching the real `docs/todo.md`, which neither
existed nor was visible before this point), with:

- **Yashwant:** real schema split across `supabase/migrations/001-004` (schema, RPCs,
  **RLS policies**, seed data), and real Edge Function implementations
  (`create-cashfree-order`, `cashfree-webhook`, `generate-order-qr`,
  `verify-order-qr` — actual HMAC-SHA256 via Web Crypto, not stubs)
- **Sushil:** `useAuth.jsx` as a Context Provider (`user.role`/`user.user_type` flat,
  `login`/`signup`/`logout`), a full theme system (per-service accent colors, dark
  mode), `StudentLayout`, and all student pages (Canteen/Store/Laundry/Wallet +
  checkout/status screens)
- Different stack versions entirely: React 19, react-router-dom v7, Tailwind v4
  (vs. the root scaffold's React 18 / v6 / Tailwind v3)

### Git housekeeping

A branch mix-up happened along the way — work got committed to `main` directly
(as `Admin-side-work`) instead of the `madhesh` branch as originally planned, then the
plan changed again to work on `main` directly (which is actually what
`TECH_RULES.md`'s Git Workflow section specifies for this team size). `git merge
origin/main` was run; only `.gitignore` conflicted (their more complete version was
kept). Result: **both apps existed side by side** in one repo — not committed as
final, just merged.

## 7. Phase 5 — Consolidating into one app

Decision: `campus-service-hub/` is canonical (it already had two people's real work on
it). The root-level scaffold was fully removed (`git rm` + deleted from disk),
including the now-superseded `0001_init.sql` — Yashwant's `001-004` migrations are the
schema source of truth.

Ported into `campus-service-hub/src/`:

- `components/AdminLayout.jsx` — new sidebar/nav shell for the four staff roles,
  mirroring `StudentLayout`'s structure (dark mode toggle, per-role nav tabs, sign out)
- `components/QRScannerModal.jsx` — rebuilt to call `verify-order-qr` with its
  **actual** contract (`{ qr_string, order_table }` — different from what the root
  version had assumed)
- `pages/admin/{ServiceAdminPage, CanteenAdmin, StoreAdmin, LaundryAdmin,
  PaymentsView}.jsx`
- `pages/committee/{ReceiptsQueue, WalletLog}.jsx`
- `lib/adminTheme.js` — explicit per-role Tailwind color classes (see bug #4 below)
- Added `html5-qrcode` to `campus-service-hub/package.json` (wasn't there yet)
- Wired real routes into `routes.jsx`: `/admin/canteen|store|laundry|payments`,
  `/committee/receipts|wallet-log`, with role guards (`StaffGuard`) replacing the
  placeholder page that literally said *"Admin portals are managed by Madheshwaran"*
- Dropped the standalone `Register.jsx` — Sushil's `Login.jsx` already has a
  Login/Register toggle in one page, this was redundant
- Dropped the "Remove item" delete button from the menu grid — no `DELETE` RLS policy
  exists on `canteen_items`/`store_items`, so it would always fail silently

## 8. Bugs found and fixed during integration/verification

None of these were introduced by the admin/committee work — they surfaced once real
login + RLS were exercised end-to-end for the first time.

1. **`Login.jsx` never redirected after a successful login.** No `useNavigate` import,
   no redirect call — the app would just sit on `/login` forever even after auth
   succeeded. Fixed: added `navigate('/')` on both login and signup success.

2. **This Supabase project never had Yashwant's RLS or seed data applied** — only the
   (now-removed) root-scaffold schema had been run here. Applied his `002` (RPC
   refresh), `004` (seed data), and `003` (RLS policies) migrations properly.

3. **Missing RLS policy broke student signup.** Once RLS was live, a new hosteller's
   wallet auto-creation (`insert into wallets`) failed — `003_rls_policies.sql` has
   `SELECT` policies on `wallets` but no `INSERT` policy. Added one, scoped tight:
   ```sql
   create policy "Hostellers insert own wallet" on wallets
     for insert with check (user_id = auth.uid() and balance = 0);
   ```
   Applied live **and** added to `supabase/migrations/003_rls_policies.sql` so it
   isn't lost.

4. **The `bg-brand`/`text-brand` theme system didn't work — root cause found and
   fixed at the source.** `index.css` declared `--color-brand: var(--theme-color)`
   once at `:root`. A custom property's `var()` reference resolves *at the element
   where it's declared*, not freshly at each element that inherits it — so
   `--color-brand`'s computed value was permanently invalid at `:root` (since
   `--theme-color` doesn't exist there), and every `.theme-canteen`/`.theme-store`/etc.
   descendant inherited that same invalid value even though *they* define
   `--theme-color` locally. This made every `bg-brand`/`text-brand`/`border-brand`
   element render fully transparent — confirmed on both the admin pages and Sushil's
   student pages (the "Add" button, the checkout page's "Pay via UPI" button, category
   chips, nav highlights — all invisible or washed-out in both light and dark mode).
   **Fixed** by redeclaring `--color-brand`/`--color-brand-hover`/`--color-brand-bg`/
   `--color-brand-light` inside each `.theme-*` block in `index.css` itself, so each
   one resolves `--theme-color` against its own rule instead of inheriting the broken
   value from `:root`. Verified live: the Canteen "Add" button and the checkout page's
   "Pay ₹40.00 via UPI" button both render solid red in light and dark mode. The
   admin-side workaround (`src/lib/adminTheme.js`, explicit literal color classes) is
   still in place and doesn't need to change, but could be reverted to use `bg-brand`
   directly now that the underlying bug is fixed, if that's preferred for consistency.

## 9. Current status (verified live, both sides)

**Admin** (`canteen.admin@campus.test` / `CanteenAdmin123!`) → `/admin/canteen`:
correct red theme, real seed menu (Masala Dosa, Idli, Veg Biryani, Samosa, Cold
Coffee), inline edit works, Add Item works, stats bar computes correctly, Payments tab
loads (empty — no payments recorded yet).

**Student** (self-registered via `/login` → Register tab): lands on
`/student/canteen`, same 5 seeded items render with images, hosteller-only nav
(Store/Laundry/Wallet) shows correctly, wallet gets created with `balance: 0`.

**Not yet functional (not this track's scope):**
- QR scanning has nothing to scan against — orders only get created via the Cashfree
  checkout flow, which isn't wired up on the student side yet
- Cashfree sandbox credentials were never obtained/set as Edge Function secrets — this
  was Madheshwaran's task (`T1-004` in `todo.md`) and is still outstanding
- Firebase Hosting setup + deploy (`T1-003`/`T8-001`, Yashwant's tasks) — not started

## 10. Remaining work (see `docs/todo.md` for full task list)

- **Mine:** T1-004 (Cashfree sandbox account + Edge Function secrets)
- **Worth double-checking on Sushil's side:** does `CanteenCheckout.jsx` actually call
  `create-cashfree-order` and open the real Cashfree SDK? Does `CanteenStatus.jsx`
  render the QR from `generate-order-qr`'s response? Is `Wallet.jsx`'s fee-receipt
  upload + balance history fully wired to Supabase?
- ~~Flag to Sushil: the `bg-brand` theme bug~~ — fixed at the source, see §8.4
- **Flag to Yashwant:** the missing wallet INSERT policy is now patched, but should be
  reviewed/merged properly rather than just living in a follow-up commit
- **Team:** Firebase Hosting + final deploy, Review 1 / Review 2 demo checkpoints —
  blocked until the Cashfree/QR flow is wired end-to-end

## 11. How to run this locally

```powershell
cd campus-service-hub
npm install   # if not already done
npm run dev   # http://localhost:5173
```

Needs `campus-service-hub/.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(copy from `.env.example` and fill in the real project's values — ask the team for
them, don't commit real keys).

## 12. Incident — an external `git reset` wiped the Phase 5 work, then it got rebuilt

After Phase 5 was verified working, a `git reset` was run on `main` outside of this
build process (visible in `git reflog`), which discarded every **uncommitted** change
at once: the `routes.jsx` wiring, the `Login.jsx` redirect fix, the RLS wallet policy
fix, and the root-scaffold deletion all reverted back to the merge commit
(`280b399`) — which is why the root-level `postcss.config.js` came back and broke
Tailwind for `campus-service-hub` again (the exact same PostCSS-upward-resolution
conflict from §7 that motivated removing the root scaffold in the first place).

On top of that reverted state, a commit called `first-review-work` was made that
**force-added `campus-service-hub/node_modules/` (6,985 files, ~1.29M lines) and
`campus-service-hub/.env`** to git — both are correctly listed in `.gitignore` at
both levels, so this had to bypass it (e.g. an IDE "stage all" action, or `git add
-f`). A subsequent `git pull` merged in Yashwant's newest commit on top. **All of
this was already pushed to `origin/main`** by the time it was noticed — local `main`
and `origin/main` were in perfect sync (0 ahead, 0 behind).

**Decision made:** leave the bad commit's history alone rather than rewrite it (a
`git filter-repo` + force-push would require Yashwant and Sushil to re-clone or
hard-reset mid-hackathon — too disruptive for the size of the problem). Instead:

- `git rm -r --cached` on `campus-service-hub/node_modules` and
  `campus-service-hub/.env` — stops tracking them **going forward** without touching
  history or deleting the actual files from disk
- Every lost Phase 5 file was rebuilt from scratch, verbatim, from what was already
  known to work: `AdminLayout.jsx`, `QRScannerModal.jsx`, `adminTheme.js`, all of
  `pages/admin/` and `pages/committee/`, the `routes.jsx` wiring, the `Login.jsx`
  redirect fix, `package.json`'s `html5-qrcode` dependency, and the
  `003_rls_policies.sql` wallet policy (the **database** still had this policy —
  only the file needed re-adding, confirmed by querying `pg_policies` directly)
- Root-level duplicate scaffold removed a second time
- Re-verified end-to-end: admin login → `/admin/canteen` → same red theme, same seed
  menu, zero console errors — matching the state from before the reset

**Lesson for the team:** be careful with `git reset`/`git checkout .` when there are
uncommitted changes worth keeping, and double-check what an IDE's "stage all"
actually staged before committing — especially in a repo with a nested app folder
(`campus-service-hub/`) that has its own `.gitignore`.

## 13. Git state at time of writing

Everything above (recovered Phase 5 work + the untrack-going-forward fix for
`node_modules`/`.env`) is sitting in the working tree, **not yet committed**. The
`first-review-work` commit and its node_modules/.env bloat remain in history on
`origin/main` per the decision in §12 — nothing there was rewritten.
