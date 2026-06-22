# Mobile App Cutover — `smartwash-app` is the canonical mobile app

> **Status (2026-06-22): Phase 1 (freeze + alignment) in progress.**
> `apps/smartwash-app` (Flutter super app) is the single long-term mobile app.
> `apps/customer-app` and `apps/driver-app` (React Native / Expo) are **legacy /
> reference-only** during cutover. They are **kept working** but receive **no new
> features**. Retirement is **phased, not big-bang** — see the plan below.

This is the source of truth for the mobile cutover. CLAUDE.md already records the
decision ("`apps/smartwash-app` is the single Flutter super app… legacy RN apps
being retired — do NOT add new features to the RN apps"); this doc adds the
audit, the gap list, and the concrete step-by-step retirement plan.

---

## 1. Why one app

- **One login, three roles** (Customer · Driver · Staff) from a single Keycloak
  client (`smartwash-app`), role chosen from `realm_access.roles`. No per-role app,
  no re-login to switch role.
- **One codebase** to maintain: shared auth, networking, design system, models.
- The two RN apps were Phase-1/Phase-4 minimal slices; they were never intended to
  be the long-term surface.

---

## 2. Audit — current state (2026-06-22)

### 2.1 `apps/smartwash-app` (Flutter) — canonical

Verified present and wired:

| Area | Status |
|---|---|
| Role-based routing | ✅ `lib/router/app_router.dart` — login → role redirect → Customer/Driver/Staff shells; multi-role → `RoleSelectScreen`; profile → switch mode |
| Auth service | ✅ `core/auth/` — ROPC login, JWT decode, **token refresh + 401 retry interceptor**, secure storage (`flutter_secure_storage`), logout |
| API client | ✅ `core/api/api_client.dart` — single Dio client, auto `Authorization` + `Idempotency-Key` on writes; **superset** of both legacy apps' endpoints |
| Customer flow | ✅ Home, Orders, Order detail, Rating, Scan + scan-result, Order wizard (branch→machine→cycle→confirm), Topup + **slip image upload (multipart)**, Delivery request + track, Notifications, Profile |
| Driver flow | ✅ Tasks + task detail (accept/reject/advance), Map, Earnings, Profile, location reporting |
| Staff flow | ✅ Machines, Orders, **Slip review (approve/reject)**, Profile |
| Design system | ✅ `design_system/` — SwColors, SwTypography, SwButton, SwBadge, SwCard, SwEmptyState |

**Endpoint coverage** — the Flutter client implements every BFF endpoint the legacy
apps call, plus several they do not:

- Customer: branches, machines, orders (list/get/create), queue join, wallet,
  topup QR, payment status, notifications (+read-all), request-delivery, delivery
  track, ratings — **plus** `getMachineById` (QR scan) and `uploadSlipImage`
  (multipart slip), which the legacy customer-app lacks.
- Driver: deliveries (list/get/accept/reject/advance), location, earnings — full parity.
- Staff: `/bff/staff/machines`, `/bff/staff/orders`, `/bff/staff/slips` (+approve/reject)
  — **no legacy equivalent** (RN apps had no staff mode).

### 2.2 `apps/customer-app` (React Native / Expo) — legacy

Minimal Phase-1 customer slice. Screens: login (auth), tabs (index/orders/scan/
profile), order (create/machines/confirm), delivery (request/track/delivered),
topup, notifications.

### 2.3 `apps/driver-app` (React Native / Expo) — legacy

Minimal Phase-4 driver slice. Screens: login (auth), tabs (tasks/map/earnings/
profile), delivery `[id]`.

---

## 3. Gap analysis

### 3.1 What `smartwash-app` already covers
All customer + driver + staff flows above. For day-to-day use it is a strict
superset of both legacy apps.

### 3.2 Still only in `customer-app` (legacy)
- ~~**Saved addresses CRUD**~~ — **CLOSED (Phase 2, 2026-06-22).** Flutter now has
  `listAddresses` / `createAddress` / `deleteAddress` in `api_client.dart`, an
  `Address` model, a management screen (`features/customer/profile/addresses_screen.dart`,
  routed from the profile tile at `/customer/addresses`), and the delivery request
  flow selects real saved addresses (real `lat/lng`) via a picker — the hardcoded
  `lat: 0, lng: 0` free-text path is gone. Backend (`/bff/addresses`) supports
  list/create/delete only (no update; cap 10/user); lat/lng entered via numeric
  fields (no map picker — would need a new dependency).
- Nothing else customer-only remains.

### 3.3 Still only in `driver-app` (legacy)
- Nothing functional that the Flutter app lacks. Driver endpoint parity is
  complete.
- ~~Verify real-GPS streaming on the Flutter map~~ — **RESOLVED (Phase 3,
  2026-06-22).** Audit corrected the earlier suspicion: the legacy RN app already
  used **real** GPS (`expo-location`) from *both* `map.tsx` and `tasks.tsx`, not a
  demo coordinate. Flutter's `map_screen.dart` also already used real
  `Geolocator.getCurrentPosition`, but only reported while the **map tab** was
  foreground. Fixed by moving GPS reporting into a shared
  `features/driver/location/driver_location_service.dart` (StateNotifier) that
  `DriverShell` starts on enter / stops on dispose, so real `lat/lng` is posted to
  `POST /bff/driver/location` every 30s while *any* driver tab is open — matching
  legacy. Foreground-only (no background-location plumbing). The map screen now
  consumes the shared state and shows a clear GPS status chip (active / acquiring /
  denied / error) that works even without a Maps key. BFF contract unchanged.

### 3.4 Placeholder / incomplete in `smartwash-app`
- **Google Maps tile** — `features/driver/map/map_screen.dart` shows a placeholder
  until `GOOGLE_MAPS_KEY` is supplied at build time. This is **config, not a code
  gap** (documented in the app README). All other features work without it.
- **Home orders perf TODO** — `features/customer/home/home_screen.dart` filters
  orders client-side; noted TODO to push filtering to BFF/order service. Cosmetic
  perf item, not a parity blocker.

### 3.5 Pre-existing doc/code mismatches found during audit
- Both legacy READMEs said "paste a Keycloak token on the first screen", but both
  `(auth)/login.tsx` screens already do **real phone/username + password ROPC
  login**. Fixed in Phase 1 (README rewrite).
- `BUILD_PLAN.md` tech-stack + structure listed only RN for mobile. Fixed in
  Phase 1.
- `RUNBOOK.md` §6 documented only Expo UI testing. Flutter path added in Phase 1.

---

## 4. Phased cutover plan

### Phase 1 — Freeze + alignment (this PR) — SAFE, no behavior change
- [x] `docs/MOBILE_CUTOVER.md` (this doc): gap analysis + plan + parity checklist.
- [x] `BUILD_PLAN.md`: name Flutter `smartwash-app` primary; mark RN apps legacy.
- [x] `RUNBOOK.md` §6: add Flutter UI-testing path; mark Expo path legacy.
- [x] Legacy READMEs: LEGACY banner at top + fix stale "paste token" claim.
- [x] Legacy `package.json` descriptions prefixed `[LEGACY]`.
- [x] Small in-app legacy notice on both legacy login screens.
- **No** code deletion, **no** package renames, **no** contract changes,
  **no** auth changes.

### Phase 2 — Parity completion (later PRs, one concern each)
- [x] **Saved addresses in Flutter** (2026-06-22): added `listAddresses` /
  `createAddress` / `deleteAddress` to `api_client.dart` + an `Address` model;
  added a saved-address picker + management screen and replaced free-text +
  `lat/lng:0` in `delivery_request_screen.dart`. Client-only change; no map-based
  coordinate picker (deferred — needs a new dependency).
- [x] **Driver real-GPS** (Phase 3, 2026-06-22): shared `DriverLocationService`
  reports real device GPS to the BFF across all driver tabs (foreground-only);
  map shows a live GPS status chip. Legacy was already real GPS — no demo
  coordinate existed; the gap was map-tab-only reporting in Flutter.
- [ ] Resolve the home-screen orders filtering TODO (push to BFF) — optional.
- [ ] Sign-off: a real device runs every customer + driver flow on Flutter with no
  need to fall back to a legacy app.

### Phase 3 — Legacy retirement (only after Phase 2 sign-off + owner approval)
- [ ] Remove legacy apps from default dev/test/CI paths (stop building/typechecking
  them by default); keep the directories.
- [ ] Move `apps/customer-app` and `apps/driver-app` under a clearly-labelled
  `legacy/` location **or** annotate as archived — decision deferred to that PR.
- [ ] Final deletion is a **separate, explicitly-approved** step. CLAUDE.md cleanup
  policy: when uncertain, KEEP. Do not delete in this cutover without a fresh
  approval.

---

## 5. Parity checklist (track here as Phase 2 progresses)

| Capability | smartwash-app | customer-app | driver-app | Notes |
|---|:---:|:---:|:---:|---|
| Login (phone/pwd, Keycloak ROPC) | ✅ | ✅ | ✅ | |
| Token refresh + auto-retry on 401 | ✅ | ❌ | ❌ | Flutter only |
| Multi-role switch (no logout) | ✅ | ❌ | ❌ | Flutter only |
| Branch / machine browse | ✅ | ✅ | — | |
| QR scan → machine lookup | ✅ | ✅ | — | |
| Order wizard + create | ✅ | ✅ | — | |
| Queue join | ✅ | ✅ | — | |
| Wallet balance | ✅ | ✅ | — | |
| Topup QR | ✅ | ✅ | — | |
| **Slip image upload (multipart)** | ✅ | ❌ | — | Flutter only |
| Notifications (+read-all) | ✅ | ✅ | — | |
| Ratings | ✅ | ✅ | — | |
| Delivery request | ✅ | ✅ | — | Flutter selects saved addresses (real lat/lng) |
| Delivery track | ✅ | ✅ | — | |
| **Saved addresses CRUD** | ✅ | ✅ | — | Closed Phase 2 (2026-06-22); no map picker yet |
| Driver tasks (accept/reject/advance) | ✅ | — | ✅ | |
| Driver earnings | ✅ | — | ✅ | |
| Driver location report | ✅ | — | ✅ | Real GPS, all tabs (Phase 3); foreground-only |
| Driver map (Google Maps) | ⚙️ | — | ⚙️ | Needs `GOOGLE_MAPS_KEY` |
| **Staff: machines / orders / slip review** | ✅ | — | — | Flutter only |

Legend: ✅ done · ❌ missing · ⚙️ needs config · — not applicable to that app.

---

## 6. Guardrails for this cutover

- Do **not** delete `customer-app` / `driver-app` during Phase 1 or 2.
- Do **not** merge codebases or rewrite screens wholesale.
- Do **not** rename packages / package IDs unless absolutely required.
- Do **not** change backend contracts unless a mismatch is proven.
- Do **not** touch wallet / ledger / settlement / auth semantics as part of cutover.
- Keep changes small and localized; if a step is risky or ambiguous, report it
  instead of changing it.
