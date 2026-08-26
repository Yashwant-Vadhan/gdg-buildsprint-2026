# DESIGN — Campus Service Hub

## Design Philosophy
- **Visual Style:** Clean, card-based, mobile-first. Nothing decorative — every screen exists to answer one of: "what's available", "what's my status", or "what do I do next".
- **Branding Direction:** Neutral campus-utility feel, not consumer-app flashy. Trust and clarity over polish, given the timebox.
- **UX Goals:** Minimize taps to order; make wait-time and collect-by time impossible to miss; make the QR the single obvious "proof of payment" object on screen after checkout.

## Information Architecture

```
/ (login)
├── /student
│   ├── /canteen                — menu, order, status, QR
│   ├── /store                  — (hosteller only) menu, order, status, QR
│   ├── /laundry                — (hosteller only) request, status, QR
│   ├── /wallet                 — (hosteller only) balance, receipt upload, top-up
│   └── /profile
├── /admin
│   ├── /canteen                — menu CRUD, order queue, QR scanner
│   ├── /store                  — menu CRUD, order queue, QR scanner
│   ├── /laundry                — service queue, status controls, QR scanner
│   └── /payments                — turnover-by-service table (all admins can view their own service's slice)
└── /committee
    ├── /receipts                — pending fee-receipt approval queue
    └── /wallet-log               — history of semester credits issued
```

Navigation: bottom tab bar on mobile (Canteen / Store / Laundry / Wallet, tabs hidden per role — day scholars only ever see Canteen + Profile). Admins get a simpler two-tab layout: Queue / Menu (or Queue / Receipts for Committee).

## Screen Specifications

### Login
- **Purpose:** Authenticate, route to the right role's home screen.
- **Components:** Roll number / email field, password field, submit button.
- **Empty/Error State:** Inline error on bad credentials. **Loading:** disabled button + spinner.

### Student — Canteen Menu
- **Purpose:** Browse, decide, order.
- **Components:** Item cards (name, price, prep time, remaining qty badge), a persistent header showing current queue length and "people ahead of you", cart/checkout button.
- **Interactions:** Tapping an item adds to a single-item quick order (keep the cart trivial — one item per order is fine for a hackathon, don't build a multi-item cart unless time allows).
- **Empty State:** "No items available right now" if all items are sold out or outside ordering hours.
- **Loading State:** Skeleton cards while menu loads.
- **Responsive:** Single column on mobile, becomes a 2–3 column grid ≥768px.

### Student — Checkout / Payment
- **Purpose:** Confirm order, trigger Cashfree UPI checkout.
- **Components:** Order summary (item, qty, price), "Pay with UPI" button that opens the Cashfree checkout (modal/redirect per Cashfree SDK).
- **Error State:** Payment failed → show "Payment failed, please try again", do not create/confirm the order.

### Student — Order Status + QR
- **Purpose:** Show token, live status, collect-by time, and the QR to present at pickup.
- **Components:** Large token number, status stepper (Received → Preparing → Ready → Collected) that updates live via realtime subscription, a prominent **"Collect by HH:MM"** callout, and the QR code rendered large enough to scan easily on a phone screen.
- **Loading State:** While waiting for realtime connection, show last known status with a subtle "syncing…" indicator, not a blank screen.

### Student — Hostel Store / Laundry
- Same structural pattern as Canteen (menu/service selection → confirm → wallet debit instead of Cashfree checkout → status + QR), reusing the same components where possible to save build time.
- Laundry adds a service-type selector (Wash Only / Wash & Dry / Wash, Dry & Iron / Iron Only) before confirming.

### Student — Wallet
- **Purpose:** Show balance, let the student upload a fee receipt, and (nice-to-have) recharge.
- **Components:** Balance card (large number), "Upload Fee Receipt" button + semester selector, receipt status (Pending / Approved / Rejected) once uploaded, transaction history list, "Top Up" button (nice-to-have).
- **Empty State:** No receipt uploaded yet this semester → prompt to upload.
- **Error State:** Re-uploading for a semester that's already credited → "Already credited for this semester" instead of allowing a duplicate.

### Admin — Menu / Stock Management (Canteen, Store)
- **Purpose:** Add/edit items, set availability windows and daily limits.
- **Components:** Item list with inline edit, "Add Item" form (name, price, qty, prep time, daily limit, is_available toggle).

### Admin — Order Queue + QR Scanner
- **Purpose:** See incoming orders, advance status, and verify pickup by scanning the student's QR.
- **Components:** Live order list (token, item, status, elapsed time), status-advance buttons, a "Scan QR" button that opens the device camera and calls the verify endpoint.
- **Error State:** Invalid/tampered/expired QR → red error banner, order not marked collected. Already-collected QR rescanned → amber "already collected at [time]" banner.

### Committee — Fee Receipt Queue
- **Purpose:** Approve/reject pending receipts, trigger the one-time semester credit.
- **Components:** List of pending receipts (student name/roll no, semester, receipt image thumbnail, upload date), Approve / Reject buttons.
- **Interactions:** Approve → server credits ₹2,000 to the student's wallet and marks the (student, semester) pair as credited; button disables immediately to prevent a double-click double-credit.

## Design System (lightweight — hackathon scope)
- **Colors:** Primary `#1D4ED8` (blue — trust/utility), Success `#16A34A` (Ready/Delivered/Approved), Warning `#D97706` (Preparing/Pending/collect-by approaching), Danger `#DC2626` (rejected/out of stock/invalid QR), Neutral grays `#F3F4F6`–`#111827` for backgrounds/text.
- **Typography:** System font stack (no custom font loading — saves time); base 16px, headings at 20/24/32px.
- **Spacing:** 4px base unit (4/8/12/16/24/32).
- **Grid:** Single column mobile; 2–3 column grid ≥768px for menu/list screens.
- **Components:** Button (primary/secondary/danger, default+disabled+loading states), Input (default/error/focus), Card (item card, status card), Badge (stock count, status label), Modal (QR scanner, checkout).

## Accessibility (best-effort given timebox)
- Sufficient color contrast on status badges (don't rely on color alone — pair with text labels, e.g. not just a red dot but "Out of stock").
- Buttons large enough for touch targets (min ~44px height).

## Micro-interactions
- Status stepper animates forward on realtime update (no full page reload).
- QR scan success/failure gives immediate visual + one-line text feedback (no silent failures — a mis-scan should never look like nothing happened).

## Mobile Responsiveness Strategy
- Mobile-first Tailwind breakpoints (`sm`, `md`, `lg`); bottom tab nav on mobile collapses to a top nav bar ≥768px.
- Touch targets ≥44px; QR code rendered at a size that scans reliably on a phone camera (test this at demo time, not just in the browser).
