# SmartWash UI/UX Design Specification

Approved high-fidelity design (18 screens, June 2026). Implement exactly this design system across all 4 apps.

## Design tokens

- Primary: `#2563EB` (blue-600). Primary light bg: `#EFF6FF`, `#DBEAFE`. Dark text on light blue: `#1D4ED8`.
- Text: heading `#0F172A`, body `#475569`, muted `#64748B`, hint `#94A3B8`, disabled `#CBD5E1`.
- Surfaces: page bg `#F8FAFC`, card `#FFFFFF`, border `#E2E8F0`, divider `#F1F5F9`.
- Status colors (badges = light bg + dark text, pill radius 20px, 12px/600):
  - Pending/Reserved: bg `#FEF3C7` text `#92400E`
  - Washing/Running/New: bg `#DBEAFE` text `#1D4ED8`
  - In transit: bg `#F3E8FF` text `#7E22CE`
  - Delivered/Idle/success: bg `#DCFCE7` text `#166534`
  - Cancelled/Error/Offline: bg `#FEE2E2` text `#B91C1C`
- Success `#16A34A`, warning `#F59E0B`, danger `#DC2626`/`#B91C1C`.
- Radius: cards 14–18px, buttons 12–14px, inputs 14–16px, pills 20px.
- Borders 1–1.5px solid; selected state = 2px solid `#2563EB` + bg `#EFF6FF`.
- Currency: kip, format `₭35,000` via a `formatKip()` helper. Lao names in seed/demo data.
- Icons: Tabler icons (outline). Font: system sans; weights 400/600/700. Light mode only.

## Web portals (owner-portal, admin-portal) — React + Vite + react-router-dom v7

Shared shell:
- Left sidebar 232px white, 1px right border: logo (36px blue rounded square + wordmark), section labels (11px gray uppercase), nav items (14px, 10px radius; active = bg `#EFF6FF` text `#2563EB` 600), count badges, user block pinned at bottom.
- Top navbar 64px white, bottom border: search input (bg `#F1F5F9`, radius 10px) — admin only; bell icon w/ red dot; profile chip (avatar circle + name + role + chevron).
- Content: 24/28px padding, page title 21px/600 + subtitle 13px muted.
- KPI cards: white, border, radius 14px, 18px padding: label 13px muted, value 24–28px/600, delta line 12px (green `+12% vs yesterday` w/ trending icon).

### Admin portal pages
1. **Dashboard**: 4 KPI (orders today, active orders, revenue today, completed deliveries) · line chart (orders 7 days, blue w/ light-blue area) · bar chart (revenue by branch) · donut (order status distribution w/ legend) · recent-orders table · live activity feed (right column 300px; icon-tile rows w/ colored 32px rounded-square icons + timestamp).
2. **Orders**: header + Export / New order buttons · status filter chips (All/Pending/Washing/In transit/Delivered w/ counts; active = dark bg) · filter + date-range buttons · table: checkbox, Order ID (blue link), Customer, Branch, Service (icon + label), Status badge, Driver ("Unassigned" muted), Created, Price (600), actions (eye/edit/dots) · footer pagination ("Showing 1–10 of N", numbered pages).
3. **Payments**: 4 KPI (received today, auto-verified by OCR, awaiting manual review [amber-highlighted card], rejected/fraud) · review queue list (slip thumbnail, amount + customer, OCR confidence + reason, QR ref + bank + age, green Approve / outlined red Reject buttons) · recent transactions list (top-up +green, order deduct, refund).

### Owner portal pages (branch-scoped; branch picker in topbar, resolved from JWT)
1. **Dashboard**: 4 KPI (revenue today, orders today, machine utilization %, next settlement amount + payout date) · Machines grid (cards: `M-01 · Washer 18kg`, status badge, order/time-left + progress bar when running, "Available now" when idle, error card = red border/bg + error code + "Request service" button, maintenance = gray) · today-by-hour mini bar chart · slip review queue card with count badge.
2. Machines / Orders / Slip review / Settlements pages following same patterns.

## Customer app (customer-app) — Expo + expo-router, bottom tabs: Home / Orders / Scan / Profile

1. **Login**: centered logo (76px blue rounded square), app name 26px/700, tagline, phone + password inputs (1.5px border, radius 14px), forgot-password link, blue Sign in button, divider "or continue with", Google/Facebook outline buttons, "Create account" footer. (Wire to Keycloak; replace token paste.)
2. **Home / tracking**: greeting header + bell w/ dot · active-order hero card (blue bg, order id, status pill, est. time + branch row, white progress bar, "56% · 24 min remaining") · "Order progress" vertical timeline: done = green circle w/ check, current = blue circle w/ icon + light-blue halo, future = gray; sub-labels (time, machine, ETA) · driver card (avatar initials, name, rating, message + call buttons).
3. **Create order**: service cards Wash/Dry/Iron (icon, name, price/kg; selected = 2px blue + `#EFF6FF`) · weight stepper (− gray / + blue squares, "≈ N machine loads") · pickup address + time-window rows (icon tile, label + sub, chevron) · dashed-divider price summary · Confirm button. POST /bff/orders.
4. **Choose machine**: branch summary row (name, distance, hours, Change link) · filter chips (All/Available/Washers/Dryers) · 2-col machine grid: idle = green 2px border + `#F0FDF4` + "Start now →"; running = progress bar + "N min left · join queue"; reserved = amber queue estimate; offline = red badge, dimmed. Cards tappable (idle → order, running/reserved → POST /bff/queues/:machineId/join).
5. **Orders history**: filter chips All/Active/Done/Cancelled · order cards (id, status badge, service · kg · branch, date + price; active card = 2px blue + track-live; done cards have Receipt / Reorder; cancelled = struck-through price + refund note).
6. **Scan QR**: dark screen `#0F172A`, 280px scan frame (cyan `#38BDF8` corner brackets + scan line), flashlight chip, "Enter machine code" fallback card. Dark bottom nav, active tab cyan.
7. **Top up wallet**: balance row · amount chips (₭50k/₭100k/₭200k) · BCEL OnePay QR card (QR, ref + expiry) · dashed "Upload payment slip" row · amber "Waiting for payment…" banner (poll GET /bff/payments/:qrRef).
8. **Notifications**: "Mark all read" · TODAY (unread = `#EFF6FF` cards w/ blue dot) / EARLIER (plain rows) · icon tiles per type. GET /bff/notifications.
9. **Request delivery**: order summary · two option cards "Deliver to me (from ₭8,000)" / "I'll pick up (free)" · saved addresses (selected = blue border + check) + "Add new address" · delivery window chips · fee + wallet balance + Request button. POST /bff/orders/:id/request-delivery.
10. **Live delivery tracking**: full-screen map (route polyline, branch pin, driver dot w/ tooltip "Khamla · 1.4 km away", destination green pin), "Arrives ~15:18" chip · bottom sheet: title + status badge, 5-segment progress bar, driver card (vehicle + plate + rating, message/call). GET /bff/deliveries/:id/track.
11. **Delivered + rating**: big green check, "Delivered!", arrival summary · rating card (5 stars amber, tag chips) · price recap · Submit rating + View receipt.
12. **Profile**: avatar initials, name, phone · blue wallet card (balance + Top up) · 3 stat tiles · menu rows (addresses, order history, notifications w/ count, help, red Sign out).

## Driver app (driver-app) — Expo + expo-router, bottom tabs: Tasks / Map / Earnings / Profile

1. **Tasks list**: header (avatar, name, "● Online · GPS active", earned-today) · "New assignments": cards 2px blue border (id + type, New badge, pickup/dropoff/fee rows, Accept + outlined red Reject) · "In progress": card w/ customer + order, distance, green action button for next FSM state. Confirmation dialog before Delivered/Complete.
2. **Delivery detail**: top 40% map (route, pins, distance chip) · bottom sheet: customer card (message/call), pickup→dropoff timeline, fee row, green "Mark as delivered". Background GPS via expo-location.

## Implementation notes

- apps/* are standalone npm packages (not in root workspace).
- Replace token-paste with real Keycloak auth; decode JWT to decode and assert expected role per app; handle 401 with friendly "Session expired".
- Map errors to friendly messages (401/409/5xx). No raw `String(e)`.
- Centralize shared tokens/components per app (Button, Card, Badge, KpiCard).
- Replace hardcoded localhost apiBaseUrl with env-driven config.
