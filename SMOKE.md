# AdNabbit Web MVP — Smoke Test Results

**Date:** 2026-09-18 (America/Denver, MDT)  
**Environment:** box local, SQLite + Next.js 14.2.35, `npm run dev` on http://localhost:3000

## Setup commands run

```bash
cd /workspace/adnabbit-web
# .env already present with SQLite + NextAuth + ADMIN_* 
npm install   # (done during scaffold)
npx prisma migrate dev --name init --skip-seed
npm run db:seed
# Seeded ADMIN: admin@adnabbit.com
npm run dev
```

## Smoke script (API)

Created `/tmp/smoke-test.png` (69-byte 1×1 PNG).

### 1. Advertiser signup — PASS

```bash
curl -s -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"advertiser@example.com","password":"advertiser123","name":"Smoke Advertiser"}'
```

**Result:** `HTTP 201`  
`{"user":{"email":"advertiser@example.com","role":"ADVERTISER",...}}`

### 2. Advertiser login (NextAuth credentials) — PASS

```bash
# CSRF + cookie jar
curl -s -c /tmp/adv-cookies.txt http://localhost:3000/api/auth/csrf
curl -s -b /tmp/adv-cookies.txt -c /tmp/adv-cookies.txt \
  -X POST http://localhost:3000/api/auth/callback/credentials \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "csrfToken=$CSRF&email=advertiser@example.com&password=advertiser123&json=true"
curl -s -b /tmp/adv-cookies.txt http://localhost:3000/api/auth/session
```

**Result:** Session shows `role: ADVERTISER`

### 3. Upload creative — PASS

```bash
curl -s -b /tmp/adv-cookies.txt -X POST http://localhost:3000/api/creatives \
  -F "name=Smoke Test Banner" \
  -F "notes=Automated smoke upload" \
  -F "file=@/tmp/smoke-test.png;type=image/png"
```

**Result:** `HTTP 201`, status `DRAFT`, file on disk under `uploads/<uuid>.png`

### 4. Submit for review — PASS

```bash
curl -s -b /tmp/adv-cookies.txt -X POST http://localhost:3000/api/creatives/$CREATIVE_ID/submit
```

**Result:** `HTTP 200`, status `PENDING`

### 5. Admin login (seeded) — PASS

```bash
# Same CSRF/cookie flow with admin@adnabbit.com / admin123!
```

**Result:** Session shows `role: ADMIN`

### 6. Approve — PASS

```bash
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/creatives/$CREATIVE_ID/approve
```

**Result:** `HTTP 200`, status `APPROVED`

### 7. Reject path — PASS

Second creative submitted, then:

```bash
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/creatives/$ID2/reject \
  -H 'Content-Type: application/json' \
  -d '{"reason":"Logo too small for screen"}'
```

**Result:** `HTTP 200`, status `REJECTED`, `rejectReason` set

### 8. Advertiser list — PASS

```bash
curl -s -b /tmp/adv-cookies.txt http://localhost:3000/api/creatives
```

**Result:** Lists own creatives including `APPROVED` and `REJECTED` with reason

### 9. UI pages — PASS

| Path | Cookie | Status |
|------|--------|--------|
| `/` | advertiser | 307 → dashboard |
| `/login` | — | 200 |
| `/signup` | — | 200 |
| `/dashboard` | advertiser | 200 |
| `/creatives/new` | advertiser | 200 |
| `/admin` | advertiser | 307 (redirect) |
| `/admin` | admin | 200 |

## Auth approach (documented)

**NextAuth.js v4** with Credentials provider, **JWT session strategy**, bcrypt password hashes. Roles stored as strings on `User.role` (`ADVERTISER` | `ADMIN`). Admin created only via `npm run db:seed` from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Blockers

None for local SQLite MVP. Postgres was not running on the box; SQLite used as specified.

---

# Ticket A — Host/screen inventory smoke

**Date:** 2026-09-18 (America/Denver)  
**Prereq:** migrations applied (`npx prisma migrate dev`), `npm run db:seed`, `npm run dev` on :3000

## Setup

```bash
cd /workspace/adnabbit-web
npx prisma migrate dev --name host_screen_inventory   # already applied in this branch
npm run db:seed
# Seeded ADMIN + sample hosts/screens (Denver Peak Fitness, Mile High Sports Bar, …)
```

## A1. Non-admin blocked — PASS expected

```bash
# Advertiser session cookie jar from MVP smoke (or re-login)
curl -s -o /dev/null -w "%{http_code}" -b /tmp/adv-cookies.txt http://localhost:3000/api/admin/hosts
# expect 403

curl -s -o /dev/null -w "%{http_code}" -b /tmp/adv-cookies.txt -L http://localhost:3000/admin/hosts
# UI redirects away from admin (307 → dashboard)
```

## A2. Admin list seeded hosts — PASS expected

```bash
# Admin login (admin@adnabbit.com / admin123!)
curl -s -c /tmp/admin-cookies.txt http://localhost:3000/api/auth/csrf
# then credentials callback with csrfToken…

curl -s -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/hosts | head -c 500
# expect hosts array with vertical GYM, SPORTS_BAR, MEDICAL_DENTAL, OTHER(+otherLabel)
```

## A3. Create host with vertical + OTHER otherLabel — PASS expected

```bash
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/hosts \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Cafe","vertical":"RESTAURANT_FB"}'
# expect 201

curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/hosts \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Other","vertical":"OTHER"}'
# expect 400 otherLabel required

curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/hosts \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Other","vertical":"OTHER","otherLabel":"Pop-up market"}'
# expect 201
```

## A4. Create screen (no vertical on screen) — PASS expected

```bash
HOST_ID=…  # from create or list
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/screens \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Lobby\",\"city\":\"Aurora\",\"zip\":\"80012\",\"inventoryStatus\":\"OPEN\",\"hostId\":\"$HOST_ID\"}"
# expect 201; response host.vertical present via join, no vertical field on screen itself
```

## A5. Filter screens — PASS expected

```bash
curl -s -b /tmp/admin-cookies.txt "http://localhost:3000/api/admin/screens?city=Denver"
curl -s -b /tmp/admin-cookies.txt "http://localhost:3000/api/admin/screens?zip=80202"
curl -s -b /tmp/admin-cookies.txt "http://localhost:3000/api/admin/screens?inventoryStatus=OPEN"
curl -s -b /tmp/admin-cookies.txt "http://localhost:3000/api/admin/screens?vertical=GYM"
```

## A6. UI pages — PASS expected

| Path | Cookie | Expect |
|------|--------|--------|
| `/admin/hosts` | admin | 200 |
| `/admin/screens` | admin | 200 |
| `/admin/hosts` | advertiser | redirect |
| `/admin/screens?city=Denver&vertical=GYM` | admin | 200 filtered |

## Demo path

1. Log in as `admin@adnabbit.com` / `admin123!`
2. Nav → **Hosts** → browse seeded venues; open one; note vertical
3. Nav → **Screens** → filter by city Denver + vertical GYM
4. Create host (pick vertical; if OTHER fill otherLabel) → create screen under it

## Blockers

None for local Ticket A.


## Ticket A verified results (2026-09-18 ~1:30 PM MT)

| Check | Result |
|-------|--------|
| A1 Non-admin API `/api/admin/hosts` | **PASS** HTTP 403 |
| A1 Non-admin UI `/admin/hosts` | **PASS** HTTP 307 → `/dashboard` |
| A2 Admin list hosts (seeded) | **PASS** GYM, SPORTS_BAR, MEDICAL_DENTAL, OTHER(+Coworking) |
| A3 Create host `RESTAURANT_FB` | **PASS** 201 |
| A3 OTHER without otherLabel | **PASS** 400 |
| A3 OTHER with otherLabel | **PASS** 201 |
| A4 Create screen | **PASS** no `vertical` on screen; `host.vertical` via join |
| A5 Filter city/zip/inventory/vertical | **PASS** (e.g. vertical=GYM → 2) |
| A6 Admin UI pages | **PASS** all 200 |

Forge vertical lock confirmed in seed/API: `GYM`, `PROFESSIONAL` (not GYM_FITNESS / PROFESSIONAL_SERVICES).

---

# Ticket B — Advertiser public profiles smoke

**Date:** 2026-09-18 (America/Denver)  
**Prereq:** migrations applied (`advertiser_profiles`), `npm run db:seed`, `npm run dev` on :3000

## Setup

```bash
cd /workspace/adnabbit-web
npx prisma migrate dev --name advertiser_profiles   # already applied on this branch
npm run db:seed
# Seeded demo.advertiser@adnabbit.com / demo123! + published /a/front-range-hvac
npm run dev
```

## B1. Public published profile — PASS expected

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/a/front-range-hvac
# expect 200; body contains "Front Range HVAC"
curl -s http://localhost:3000/a/front-range-hvac | grep -o "Front Range HVAC" | head -1
```

## B2. Unpublished / missing → soft not available — PASS expected

```bash
curl -s http://localhost:3000/a/does-not-exist | grep -o "Profile not available" | head -1
# expect "Profile not available"
```

## B3. Advertiser create/edit + publish — PASS expected

```bash
# Login as demo.advertiser@adnabbit.com / demo123! (CSRF + credentials callback → /tmp/demo-cookies.txt)

curl -s -b /tmp/demo-cookies.txt http://localhost:3000/api/profile
# expect existing Front Range HVAC profile

curl -s -b /tmp/demo-cookies.txt -X PUT http://localhost:3000/api/profile \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Front Range HVAC","pitch":"Updated pitch","website":"https://example.com","contact":"303-555-0100","category":"PROFESSIONAL","serviceAreaZips":"80202,80205","published":true}'
# expect 200, slug front-range-hvac (or collision-safe)
```

## B4. Non-advertiser cannot edit profile — PASS expected

```bash
curl -s -o /dev/null -w "%{http_code}" -b /tmp/admin-cookies.txt -X PUT http://localhost:3000/api/profile \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Nope","published":true}'
# expect 403
```

## B5. Admin list + unpublish — PASS expected

```bash
curl -s -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/profiles | head -c 400
# expect profiles array with published Front Range HVAC

PROFILE_ID=…  # from list
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/profiles/$PROFILE_ID/unpublish
# expect published:false

curl -s http://localhost:3000/a/front-range-hvac | grep -o "Profile not available" | head -1
# expect not available after unpublish

# Re-publish via demo advertiser PUT published:true for further demos
```

## B6. UI pages — PASS expected

| Path | Cookie | Expect |
|------|--------|--------|
| `/a/front-range-hvac` | — | 200 (when published) |
| `/profile` | demo advertiser | 200 |
| `/admin/profiles` | admin | 200 |
| `/admin/profiles` | advertiser | redirect |
| `/api/admin/profiles` | advertiser | 403 |

## Demo path

1. Open http://localhost:3000/a/front-range-hvac (anonymous) — see Front Range HVAC
2. Log in as `demo.advertiser@adnabbit.com` / `demo123!` → **Profile** → edit pitch / publish
3. Log in as `admin@adnabbit.com` / `admin123!` → **Profiles** → Unpublish → public page shows not available

## Blockers

None for local Ticket B.

## Ticket B verified results (2026-09-18 ~1:35 PM MT)

| Check | Result |
|-------|--------|
| B1 Public `/a/front-range-hvac` | **PASS** HTTP 200, “Front Range HVAC” |
| B2 Missing slug soft not-available | **PASS** |
| B3 Advertiser GET/PUT `/api/profile` | **PASS** slug `front-range-hvac` |
| B4 Admin PUT `/api/profile` | **PASS** HTTP 403 |
| B5 Admin list + unpublish | **PASS** public becomes not available; re-publish restores 200 |
| B6 UI `/profile`, `/admin/profiles` | **PASS** 200 for roles; advertiser 403/307 on admin |
| Slug collision | **PASS** second “Front Range HVAC” → `front-range-hvac-1` |

Demo stays published at `/a/front-range-hvac` after smoke (re-published).


---

# Ticket C — Placement requests smoke

**Date:** 2026-09-18 (America/Denver)  
**Prereq:** migration `placement_requests`, `npm run db:seed` (APPROVED creative + OPEN screens), `npm run dev` on :3000

## Setup

```bash
cd /workspace/adnabbit-web
npx prisma migrate dev --name placement_requests   # already applied on this branch
npm run db:seed
# Seeded demo.advertiser + Demo Approved Banner (APPROVED) + OPEN screens
npm run dev
```

## C1. Browse OPEN/LIMITED screens — PASS expected

```bash
# Login as demo.advertiser@adnabbit.com / demo123! → /tmp/demo-cookies.txt
curl -s -b /tmp/demo-cookies.txt "http://localhost:3000/api/screens" | head -c 600
# expect screens with OPEN/LIMITED only (no FULL unless includeFull=1)

curl -s -b /tmp/demo-cookies.txt "http://localhost:3000/api/screens?city=Denver&vertical=GYM" | head -c 400
curl -s -b /tmp/demo-cookies.txt "http://localhost:3000/api/screens?includeFull=1" | head -c 200
# FULL may appear when includeFull=1
```

## C2. Create placement with APPROVED creative — PASS expected

```bash
# Get APPROVED creative id + an OPEN screen id
CREATIVE_ID=$(curl -s -b /tmp/demo-cookies.txt http://localhost:3000/api/creatives | python3 -c "import sys,json; cs=json.load(sys.stdin)['creatives']; print(next(c['id'] for c in cs if c['status']=='APPROVED'))")
SCREEN_ID=$(curl -s -b /tmp/demo-cookies.txt "http://localhost:3000/api/screens?inventoryStatus=OPEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['screens'][0]['id'])")

curl -s -b /tmp/demo-cookies.txt -X POST http://localhost:3000/api/placements \
  -H 'Content-Type: application/json' \
  -d "{\"screenId\":\"$SCREEN_ID\",\"creativeId\":\"$CREATIVE_ID\",\"note\":\"Smoke placement request\"}"
# expect 201, status REQUESTED
```

## C3. Non-APPROVED creative rejected — PASS expected

```bash
# Upload a DRAFT creative (or use a non-approved id), then:
curl -s -b /tmp/demo-cookies.txt -X POST http://localhost:3000/api/placements \
  -H 'Content-Type: application/json' \
  -d "{\"screenId\":\"$SCREEN_ID\",\"creativeId\":\"$DRAFT_ID\"}"
# expect 400 "Only APPROVED creatives…"
```

## C4. FULL screen not requestable — PASS expected

```bash
FULL_ID=$(curl -s -b /tmp/demo-cookies.txt "http://localhost:3000/api/screens?includeFull=1&inventoryStatus=FULL" | python3 -c "import sys,json; print(json.load(sys.stdin)['screens'][0]['id'])")
curl -s -b /tmp/demo-cookies.txt -X POST http://localhost:3000/api/placements \
  -H 'Content-Type: application/json' \
  -d "{\"screenId\":\"$FULL_ID\",\"creativeId\":\"$CREATIVE_ID\"}"
# expect 400 inventory FULL
```

## C5. Admin approve — PASS expected

```bash
# Admin login → /tmp/admin-cookies.txt
curl -s -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/placements | head -c 500
PLACEMENT_ID=…  # from list or create
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/placements/$PLACEMENT_ID/approve
# expect status APPROVED, reviewedAt set
```

## C6. Admin reject with reason — PASS expected

```bash
# Create another REQUESTED placement, then:
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/placements/$ID2/reject \
  -H 'Content-Type: application/json' \
  -d '{"reason":"Does not fit venue brand"}'
# expect REJECTED + rejectReason

curl -s -b /tmp/demo-cookies.txt http://localhost:3000/api/placements | head -c 800
# advertiser sees rejectReason
```

## C7. Auth gates — PASS expected

```bash
curl -s -o /dev/null -w "%{http_code}" -b /tmp/demo-cookies.txt http://localhost:3000/api/admin/placements
# expect 403
curl -s -o /dev/null -w "%{http_code}" -b /tmp/admin-cookies.txt -L http://localhost:3000/admin/placements
# expect 200
curl -s -o /dev/null -w "%{http_code}" -b /tmp/demo-cookies.txt -L http://localhost:3000/screens
# expect 200
```

## Demo path

1. `demo.advertiser@adnabbit.com` / `demo123!` → **Screens** → Request placement with Demo Approved Banner
2. `admin@adnabbit.com` / `admin123!` → **Placements** → Approve one; Reject another with reason
3. Advertiser → **Placements** → see APPROVED / REJECTED (+ reason)

## Blockers

None for local Ticket C.


## Ticket C verified results (2026-09-18 ~1:41 PM MT)

| Check | Result |
|-------|--------|
| C1 Browse OPEN/LIMITED `/api/screens` | **PASS** (6 screens; no FULL by default) |
| C2 Create placement with APPROVED creative | **PASS** 201 REQUESTED |
| C3 Non-APPROVED creative attach | **PASS** 400 |
| C4 FULL screen request | **PASS** 400 |
| C5 Admin approve | **PASS** APPROVED + reviewedAt |
| C6 Admin reject with reason | **PASS** REJECTED + rejectReason visible to advertiser |
| C6b Reject without reason | **PASS** 400 |
| C7 Auth: advertiser 403 on admin API; UI 200 | **PASS** |

Demo: `demo.advertiser@adnabbit.com` / `demo123!` (seeded APPROVED creative) → Screens → request → `admin@adnabbit.com` / `admin123!` → Placements queue.


---

# Ticket D — Scheduling smoke

**Date:** 2026-09-20 (America/Denver)  
**Prereq:** migration `schedules`, `npm run db:seed` (APPROVED placement + sample schedules), `npm run dev` on :3000

## Setup

```bash
cd /workspace/adnabbit-web
npx prisma migrate dev --name schedules   # already applied on this branch
npm run db:seed
# Seeded ACTIVE + DRAFT schedules for demo advertiser APPROVED placement
npm run dev
```

## D1. Admin list schedules — PASS expected

```bash
# Admin login → /tmp/admin-cookies.txt
curl -s -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/schedules | head -c 800
# expect schedules array (seeded ACTIVE + DRAFT)
```

## D2. Admin create from APPROVED placement — PASS expected

```bash
PLACEMENT_ID=$(curl -s -b /tmp/admin-cookies.txt "http://localhost:3000/api/admin/placements?status=APPROVED" | python3 -c "import sys,json; ps=json.load(sys.stdin)['placements']; print(ps[0]['id'])")
START=$(python3 -c "from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)+timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")
END=$(python3 -c "from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)+timedelta(days=37)).strftime('%Y-%m-%dT%H:%M:%S.000Z'))")

curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/schedules \
  -H 'Content-Type: application/json' \
  -d "{\"placementId\":\"$PLACEMENT_ID\",\"startAt\":\"$START\",\"endAt\":\"$END\",\"status\":\"ACTIVE\",\"note\":\"Smoke schedule\"}"
# expect 201 (or 409 overlap warn — then retry with acknowledgeOverlap:true)
```

## D3. Non-APPROVED placement rejected — PASS expected

```bash
REQ_ID=$(curl -s -b /tmp/admin-cookies.txt "http://localhost:3000/api/admin/placements?status=REQUESTED" | python3 -c "import sys,json; ps=json.load(sys.stdin).get('placements') or []; print(ps[0]['id'] if ps else '')")
# if empty, create a REQUESTED via demo advertiser first
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/schedules \
  -H 'Content-Type: application/json' \
  -d "{\"placementId\":\"$REQ_ID\",\"startAt\":\"$START\",\"endAt\":\"$END\"}"
# expect 400 Only APPROVED…
```

## D4. endAt must be after startAt — PASS expected

```bash
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/schedules \
  -H 'Content-Type: application/json' \
  -d "{\"placementId\":\"$PLACEMENT_ID\",\"startAt\":\"$END\",\"endAt\":\"$START\"}"
# expect 400 endAt must be after startAt
```

## D5. Overlap warn-first — PASS expected

```bash
# Create overlapping ACTIVE on same screen without acknowledge → 409 requireAcknowledge
# Retry with "acknowledgeOverlap": true → 201
```

## D6. Advertiser sees own schedules — PASS expected

```bash
# demo.advertiser login → /tmp/demo-cookies.txt
curl -s -b /tmp/demo-cookies.txt http://localhost:3000/api/schedules | head -c 800
# expect own schedules; admin-created smoke schedule visible
```

## D7. Cancel path — PASS expected

```bash
SCHEDULE_ID=…  # from create
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/schedules/$SCHEDULE_ID/cancel
# expect CANCELLED + cancelledAt

curl -s -b /tmp/demo-cookies.txt http://localhost:3000/api/schedules | grep -o CANCELLED | head -1
```

## D8. Auth gates — PASS expected

```bash
curl -s -o /dev/null -w "%{http_code}" -b /tmp/demo-cookies.txt http://localhost:3000/api/admin/schedules
# expect 403
curl -s -o /dev/null -w "%{http_code}" -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/schedules
# expect 405 or 403 (advertiser-only GET; no POST)
curl -s -o /dev/null -w "%{http_code}" -b /tmp/demo-cookies.txt -L http://localhost:3000/schedules
# expect 200
curl -s -o /dev/null -w "%{http_code}" -b /tmp/admin-cookies.txt -L http://localhost:3000/admin/schedules
# expect 200
```

## Demo path

1. `admin@adnabbit.com` / `admin123!` → **Schedules** → see seeded ACTIVE/DRAFT → New schedule from APPROVED placement → Cancel one
2. `demo.advertiser@adnabbit.com` / `demo123!` → **Schedules** → read-only list includes admin-created windows

## Blockers

None for local Ticket D.


## Ticket D verified results (2026-09-20 ~10:22 AM MT)

| Check | Result |
|-------|--------|
| D1 Admin list `/api/admin/schedules` | **PASS** seeded ACTIVE + DRAFT |
| D2 Admin create from APPROVED | **PASS** 201 ACTIVE |
| D3 Non-APPROVED placement | **PASS** 400 |
| D4 endAt ≤ startAt | **PASS** 400 |
| D5 Overlap warn-first | **PASS** 409 `requireAcknowledge` |
| D6 Advertiser GET `/api/schedules` | **PASS** sees own (incl. after cancel) |
| D7 Cancel | **PASS** CANCELLED + cancelledAt |
| D8 Auth: advertiser 403 admin API; UI 200 | **PASS** |
| ACTIVE→ENDED on list | **PASS** past ACTIVE materialised ENDED |

Demo: `admin@adnabbit.com` / `admin123!` → Schedules; `demo.advertiser@adnabbit.com` / `demo123!` → Schedules (read-only).


---

# Ticket E — Recurring dayparts smoke

**Date:** 2026-09-20 (America/Denver)  
**Prereq:** migration `ticket_e_recurring_dayparts`, `npm run db:seed` (RECURRING Mon–Fri 09:00–11:00), `npm run dev` on :3000

## Setup

```bash
cd /workspace/adnabbit-web
npx prisma migrate deploy
npm run db:seed
# Seeded RECURRING Mon–Fri 09:00–11:00 + ONE_OFF samples
npm run dev
```

## E1. Admin list includes RECURRING — PASS expected

```bash
curl -s -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/schedules | python3 -c "import sys,json; ss=json.load(sys.stdin)['schedules']; print(sum(1 for x in ss if x['kind']=='RECURRING'), 'recurring')"
# expect ≥1 recurring
```

## E2. Admin create Mon–Fri 09:00–11:00 ACTIVE — PASS expected

```bash
PLACEMENT_ID=$(curl -s -b /tmp/admin-cookies.txt "http://localhost:3000/api/admin/placements?status=APPROVED" | python3 -c "import sys,json; print(json.load(sys.stdin)['placements'][0]['id'])")
START=$(date -u -d '+7 days' +%Y-%m-%d 2>/dev/null || python3 -c "from datetime import date,timedelta; print((date.today()+timedelta(days=7)).isoformat())")
END=$(python3 -c "from datetime import date,timedelta; print((date.today()+timedelta(days=37)).isoformat())")

curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/schedules \
  -H 'Content-Type: application/json' \
  -d "{\"placementId\":\"$PLACEMENT_ID\",\"kind\":\"RECURRING\",\"weekdays\":\"1,2,3,4,5\",\"startTime\":\"09:00\",\"endTime\":\"11:00\",\"campaignStartDate\":\"$START\",\"campaignEndDate\":\"$END\",\"status\":\"ACTIVE\",\"note\":\"Smoke Mon-Fri daypart\",\"acknowledgeOverlap\":true}"
# expect 201 RECURRING (acknowledgeOverlap if overlaps seeded daypart)
```

## E3. Non-APPROVED placement blocked — PASS expected

```bash
REQ_ID=$(curl -s -b /tmp/admin-cookies.txt "http://localhost:3000/api/admin/placements?status=REQUESTED" | python3 -c "import sys,json; ps=json.load(sys.stdin).get('placements') or []; print(ps[0]['id'] if ps else '')")
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/schedules \
  -H 'Content-Type: application/json' \
  -d "{\"placementId\":\"$REQ_ID\",\"kind\":\"RECURRING\",\"weekdays\":\"1\",\"startTime\":\"09:00\",\"endTime\":\"10:00\",\"campaignStartDate\":\"$START\",\"campaignEndDate\":\"$END\"}"
# expect 400 Only APPROVED…
```

## E4. Zero-length daypart rejected; overnight allowed (Ticket H) — PASS expected

```bash
# Equal times → 400 zero-length
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/schedules \
  -H 'Content-Type: application/json' \
  -d "{\"placementId\":\"$PLACEMENT_ID\",\"kind\":\"RECURRING\",\"weekdays\":\"1\",\"startTime\":\"22:00\",\"endTime\":\"22:00\",\"campaignStartDate\":\"$START\",\"campaignEndDate\":\"$END\"}"
# expect 400 endTime must not equal startTime

# Overnight wrap end < start → allowed (may 409 overlap warn)
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/schedules \
  -H 'Content-Type: application/json' \
  -d "{\"placementId\":\"$PLACEMENT_ID\",\"kind\":\"RECURRING\",\"weekdays\":\"5\",\"startTime\":\"22:00\",\"endTime\":\"02:00\",\"campaignStartDate\":\"$START\",\"campaignEndDate\":\"$END\",\"status\":\"DRAFT\",\"acknowledgeOverlap\":true}"
# expect 201 RECURRING overnight
```

## E5. Advertiser sees RECURRING — PASS expected

```bash
curl -s -b /tmp/demo-cookies.txt http://localhost:3000/api/schedules | python3 -c "import sys,json; ss=json.load(sys.stdin)['schedules']; print([(x['kind'], x.get('weekdays'), x.get('startTime'), x.get('endTime'), x['status']) for x in ss if x['kind']=='RECURRING'][:3])"
```

## E6. Cancel RECURRING — PASS expected

```bash
SID=$(curl -s -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/schedules | python3 -c "import sys,json; ss=json.load(sys.stdin)['schedules']; print(next(x['id'] for x in ss if x['kind']=='RECURRING' and x['status']=='ACTIVE' and 'Smoke' in (x.get('note') or '')))")
curl -s -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/schedules/$SID/cancel
# expect CANCELLED
```

## E7. Host timezone default — PASS expected

```bash
curl -s -b /tmp/admin-cookies.txt http://localhost:3000/api/admin/hosts | python3 -c "import sys,json; hs=json.load(sys.stdin)['hosts']; print(all(h.get('timezone')=='America/Denver' for h in hs), [h['timezone'] for h in hs[:2]])"
# expect True America/Denver
```

## Demo path

1. `admin@adnabbit.com` / `admin123!` → **Schedules** → see seeded RECURRING Mon–Fri 09:00–11:00 → New RECURRING → Cancel
2. `demo.advertiser@adnabbit.com` / `demo123!` → **Schedules** → read-only daypart rows
3. Admin → **Hosts** → timezone field (default America/Denver)

## Blockers

None for local Ticket E.


## Ticket E verified results (2026-09-20 ~10:40 AM MT)

| Check | Result |
|-------|--------|
| E1 Admin list includes RECURRING | **PASS** 2 ONE_OFF + 1 RECURRING seeded |
| E2 Admin create Mon–Fri 09:00–11:00 ACTIVE | **PASS** 201 RECURRING |
| E3 Non-APPROVED placement | **PASS** 400 Only APPROVED… |
| E4 Overnight daypart rejected | **PASS** 400 endTime after startTime |
| E5 Advertiser GET `/api/schedules` | **PASS** sees RECURRING dayparts |
| E6 Cancel RECURRING | **PASS** CANCELLED + cancelledAt |
| E7 Host.timezone default America/Denver | **PASS** all seeded hosts |

Demo: `admin@adnabbit.com` / `admin123!` → Schedules (ONE_OFF + RECURRING); Hosts → timezone. `demo.advertiser@adnabbit.com` / `demo123!` → Schedules read-only.


---


---

# Ticket E2 — Schedule calendar smoke

**Date:** 2026-09-20 (America/Denver)  
**Prereq:** Ticket E seed (RECURRING Mon–Fri 09:00–11:00), `date-fns` + `date-fns-tz`, `npm run dev` on :3000. No new migration.

## Setup

```bash
cd /workspace/adnabbit-web
npm run db:seed
# Seeded RECURRING Mon–Fri 09:00–11:00 (campaign starts on seed day)
npm run dev
```

Login (NextAuth CSRF + credentials → cookie jar):

```bash
# admin@adnabbit.com / admin123!  → /tmp/admin-cookies.txt
# demo.advertiser@adnabbit.com / demo123! → /tmp/demo-cookies.txt
```

## E2-1. Expand unit — RECURRING Mon–Fri 09–11 — PASS expected

```bash
cd /workspace/adnabbit-web && npx tsx -e '
import { expandSchedulesToBlocks, weekRange, isoWeekdayFromYmd } from "./src/lib/calendar-expand";
const { start, end, days } = weekRange("2026-09-22");
const schedules = [{
  id: "seed-rec", kind: "RECURRING", status: "ACTIVE",
  startAt: null, endAt: null,
  weekdays: "1,2,3,4,5", startTime: "09:00", endTime: "11:00",
  campaignStartDate: "2026-09-20", campaignEndDate: "2026-11-19",
  screen: { name: "Lobby", host: { name: "Demo", timezone: "America/Denver" } },
  placement: { creative: { name: "Demo Banner" } },
}];
const blocks = expandSchedulesToBlocks(schedules, start, end);
const mf = blocks.filter(b => b.startMinutes===540 && b.endMinutes===660);
const set = new Set(mf.map(b => b.dayYmd));
for (const d of days) {
  const iso = isoWeekdayFromYmd(d);
  if (iso<=5 && !set.has(d)) throw new Error("missing "+d);
  if (iso>=6 && set.has(d)) throw new Error("weekend "+d);
}
if (mf.length < 5) throw new Error("count "+mf.length);
console.log("PASS", start, "→", end, mf.map(b=>b.dayYmd));
'
```

## E2-2. Admin calendar week shows seeded daypart — PASS expected

```bash
# Prefer a date inside the campaign Mon–Fri span (seed campaign starts on seed day)
curl -s -o /dev/null -w "%{http_code}
" -b /tmp/admin-cookies.txt -L   'http://localhost:3000/admin/schedules/calendar?view=week&date=2026-09-22'
# expect 200
curl -s -b /tmp/admin-cookies.txt -L   'http://localhost:3000/admin/schedules/calendar?view=week&date=2026-09-22'   | grep -oE '09:00|11:00|Schedule calendar|RECURRING' | sort | uniq -c
# expect Schedule calendar + multiple 09:00–11:00 block markers
```

## E2-3. Advertiser calendar read-only 200 — PASS expected

```bash
curl -s -o /dev/null -w "%{http_code}
" -b /tmp/demo-cookies.txt -L   'http://localhost:3000/schedules/calendar?view=week&date=2026-09-22'
# expect 200
curl -s -b /tmp/demo-cookies.txt -L http://localhost:3000/schedules/calendar   | grep -o 'My schedule calendar' | head -1
```

## E2-4. List routes unchanged — PASS expected

```bash
curl -s -o /dev/null -w "%{http_code}
" -b /tmp/admin-cookies.txt -L http://localhost:3000/admin/schedules
curl -s -o /dev/null -w "%{http_code}
" -b /tmp/demo-cookies.txt -L http://localhost:3000/schedules
# expect 200 / 200
```

## Demo path

1. `admin@adnabbit.com` / `admin123!` → **Calendar** (or Schedules → Calendar) → week → Mon–Fri 09–11 → click block → detail
2. Toggle **Month** / Show CANCELLED·ENDED
3. `demo.advertiser@adnabbit.com` / `demo123!` → **Calendar** → read-only

## Screenshot-worthy URL

http://localhost:3000/admin/schedules/calendar?view=week&date=2026-09-22

## Ticket E2 verified results (2026-09-20 ~11:00 AM MT)

| Check | Result |
|-------|--------|
| E2-1 Expand unit Mon–Fri 09–11 | **PASS** |
| E2-2 Admin calendar week HTML | **PASS** 200 + 09:00–11:00 blocks |
| E2-3 Advertiser calendar | **PASS** 200 read-only |
| E2-4 List routes | **PASS** 200 |

## Blockers

None for local Ticket E2.

---

## Ticket G — Host self-serve portal (2026-09-25)

**Prereq:** migration `20260925202000_ticket_g_host_portal`, `npm run db:seed`.

### Seed logins

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@adnabbit.com | admin123! |
| ADVERTISER | demo.advertiser@adnabbit.com | demo123! |
| HOST | demo.host@adnabbit.com | host123! |

HOST is linked to **Denver Peak Fitness**.

### G-1. HOST login → own venue only

```bash
# NextAuth credentials → cookie jar /tmp/host-cookies.txt
# Session role HOST; GET /host → 200 with Denver Peak Fitness screens
# GET /admin/hosts → redirect away (not ADMIN)
# GET /api/admin/hosts → 403
```

### G-2. Host screen CRUD

```bash
# POST /api/host/screens { name, city, zip, inventoryStatus }
# PATCH /api/host/screens/:id
# DELETE /api/host/screens/:id
# Cannot touch another host's screen (404)
```

### G-3. Admin attach / detach

```bash
# POST /api/admin/hosts/:id/attach { email, password, name }
# POST /api/admin/hosts/:id/detach
# Host list shows owner email or "unclaimed"
```

### G-4. Advertiser browse still filtered

Inventory filters (city/zip/status) on `/screens` unchanged; new host screens with OPEN/LIMITED appear in browse.

### Demo path

1. `demo.host@adnabbit.com` / `host123!` → **My venue** → edit / add screen
2. Admin → **Hosts** → Denver Peak Fitness → Attach/Detach owner
3. Advertiser → **Screens** → still sees inventory



---

## Ticket J — Device claim / playlist (2026-09-25)

```bash
# As admin (session cookie) OR mint via prisma/script:
# Mint claim for Lobby TV screenId, then:
curl -s -X POST http://localhost:3000/api/device/claim \
  -H 'Content-Type: application/json' \
  -d '{"code":"XXXXXX"}'
# → deviceToken, screenId, …

curl -s http://localhost:3000/api/device/playlist \
  -H "Authorization: Bearer $DEVICE_TOKEN"
# → items[] with assetUrl, startAt/endAt ISO UTC

curl -s -X POST http://localhost:3000/api/device/play-logs \
  -H "Authorization: Bearer $DEVICE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '[{"creativeId":"…","playedAt":"…"}]'
# → 202 { accepted, persisted: false }
```

Player: see `adnabbit-player` README (`npm run claim -- --code …` then `npm start`).


---

## Ticket K — Admin folders (2026-09-25)

**Prereq:** migration `20260925223000_ticket_k_admin_folders`, optional `npm run db:seed` (sample Gyms / Bars / Local services folders).

### K-1. Admin APIs

```bash
# Admin session cookie jar /tmp/admin-cookies.txt
curl -s -b /tmp/admin-cookies.txt 'http://localhost:3000/api/admin/folders?scope=HOST'
# POST create, PATCH rename, PATCH /api/admin/folders/reorder
# PATCH /api/admin/folders/items { targetType, targetId, folderId|null }
# DELETE folder → items unfiled; Host/User rows remain
```

### K-2. UI

1. Admin → **Hosts** — create folder, drag host card into folder or **Unfiled**, drag folders to reorder
2. Admin → **Advertisers** — same folder UI for ADVERTISER users
3. HOST / ADVERTISER portals — no folder UI

Screenshot: `demo-shots/ticket-k-folders.png`

### Soft misses

Deep nesting, multi-select, mobile DnD polish, folder deep-links / search-within-folder.


---

## QA / loose-ends pass (2026-09-25 ~8:16 PM MT)

See **LOOSE_ENDS.md** for parked backlog (Stripe / Ticket M, F2, OS lockdown, deep folders, etc.).

### Fixes verified
- Remint supersedes prior live claim codes for the same screen
- Claim expiry uses `expiresAt <= now`

### Device smoke (re-run)
```bash
# web seeded + npm start on :3000
# mint via admin UI or lib, then:
cd /workspace/adnabbit-player
export ADNNABIT_API_BASE=http://127.0.0.1:3000
npm run claim -- --code XXXXXX
npm run kiosk:headless
# → heartbeat OK, playlist items, assets cached, play-logs 202
```

---

## Ticket P.1.2 — Admin device reboot (2026-09-25)

### API queue + gates
```bash
# Admin session + paired device with fresh lastSeenAt
curl -s -b /tmp/admin-cookies.txt -X POST \
  "http://127.0.0.1:3000/api/admin/screens/$SCREEN_ID/remote-control" \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"type":"command","name":"reboot"}]}'
# → {"ok":true,"queued":1,"queueLength":1,"dropped":0}

# Offline / stale heartbeat → 409
# Unknown command name → 400
# Shorthand: {"command":"reboot"} or {"command":"restartApp"}
```

### Player drain (safe — no OS reboot on build box)
```bash
cd /workspace/adnabbit-player
npm run kiosk:headless
# → input poll includes { type: 'command', name: 'reboot' }
# → [dry-run] reboot command received — would schedule clean quit + adnabbit-reboot helper

ADNNABIT_REBOOT_DRY_RUN=1 ./packaging/adnabbit-reboot
# → adnabbit-reboot: DRY RUN — would systemctl reboot
```

Electron path (mini-PC only): `ADNNABIT_REBOOT_DRY_RUN=1` logs + quits without invoking helper. Real reboot needs `scripts/install-autostart.sh` (helper + sudoers/polkit).

### P.1.3 install scripts (review)
```bash
./scripts/install-autostart.sh --help
bash -n scripts/install-autostart.sh packaging/adnabbit-reboot install.sh
```

---

## Ticket Q — Open hours / soft blackout (2026-09-26)

### Schema
```bash
npx prisma migrate deploy
# → applies 20260926164100_ticket_q_open_hours
```

### Set Mon–Fri 9–5 America/Denver (host session)
```bash
# Host portal → Edit venue → Open hours → "Mon–Fri 9–5" → Save
# or API:
curl -s -b /tmp/host-cookies.txt -X PUT http://127.0.0.1:3000/api/host/hours \
  -H 'Content-Type: application/json' \
  -d '{"weekly":[
    {"weekday":1,"openTime":"09:00","closeTime":"17:00"},
    {"weekday":2,"openTime":"09:00","closeTime":"17:00"},
    {"weekday":3,"openTime":"09:00","closeTime":"17:00"},
    {"weekday":4,"openTime":"09:00","closeTime":"17:00"},
    {"weekday":5,"openTime":"09:00","closeTime":"17:00"},
    {"weekday":6,"openTime":null,"closeTime":null},
    {"weekday":7,"openTime":null,"closeTime":null}
  ]}'
```

### Quick blackout demo (exclude "now")
Temporarily set **today** closed (or open window that does not include current local time) on Lobby TV screen override, then:
1. Paired player goes **black** within ~1 min (or immediately on next playlist tick).
2. Status chrome: `Closed hours · soft blackout`.
3. Console / heartbeat: `playbackState: "BLACKOUT"`; play-log invokes return `{ skipped: true, reason: "blackout" }`.
4. Admin screen detail / Remote view badge: **Closed hours** (device still online).

### Inside hours
Restore Mon–Fri 9–5 (or Always open). Player resumes playlist; PoP posts again; badge → Live / Empty / Idle.

### Force live (admin)
On `/admin/screens/[id]` → Open hours → set **Force live until** a future local time → Save. Closed-hours blackout lifts until that timestamp.

### Authz
- HOST can edit own venue + own screen overrides only.
- ADMIN can edit any host/screen + force-live.
- Advertisers: no hours APIs/UI.

---

## Ticket R — Fleet health + alerts (2026-09-26)

### Migrate
```bash
npx prisma migrate deploy
# → applies 20260926180000_ticket_r_fleet_health
```

### Admin fleet board
1. Sign in as admin → **Fleet** (`/admin/fleet`).
2. Paired screens show status badge (Live / Offline / Closed hours / Empty), last seen, player version, active item count.
3. Filters: All / Offline / Empty / Version / Attention.

### Offline alert (Lobby TV)
```bash
# Stop player heartbeats (quit player or block network) for >5 minutes,
# or age lastSeenAt in DB, then:
# Admin → Fleet (page load runs scan) or:
curl -s -b /tmp/admin-cookies.txt -X POST http://127.0.0.1:3000/api/admin/fleet
# → created ≥1 OFFLINE alert (deduped on repeat)
# Admin → Alerts shows one OPEN OFFLINE for Lobby TV
```
Resume heartbeats → next scan resolves the alert (status RESOLVED).

### Empty vs closed hours
- Screen in **CLOSED_HOURS** (blackout) with 0 plays → **not** Empty, **not** Offline (if still heartbeating). Badge: Closed hours.
- Screen **OPEN** / force-live with 0 active playlist items → Empty filter + EMPTY alert once.

### Host
Host portal screen cards show Online / Offline / Unpaired + last seen. No Alerts nav.

### Player version
Player heartbeat body includes `playerVersion` (package.json). Optional env `ADNNABIT_LATEST_PLAYER_VERSION` for lag flag (soft miss).

## Ticket S — Campaign windows + emergency take-down (2026-09-26)

1. **Window badges** — Admin `/admin/schedules` and advertiser `/schedules` show Active / Scheduled / Expired beside status (Schedule start/end from Ticket E).
2. **Creative take-down** — Admin review recent APPROVED → Emergency take-down → confirm → creative gone from Lobby TV playlist on next poll; Clear take-down restores if still approved + in window.
3. **Advertiser take-down** — `/admin/advertisers/[id]` → Take down advertiser → all their creatives leave playlists; clear restores.
4. **Host / screen** — `/admin/hosts/[id]` or `/admin/screens/[id]` → Kill paid playback → playlist items empty (soft); Restore clears stamp + bumps epoch.
5. **Epoch** — After take-down, `Device.playlistEpoch` increments for affected paired devices (smoke saw Lobby TV epoch advance).

---

## Ticket T — Analytics (2026-09-26 MT)

**Goal:** Admin / host / advertiser schedule-fill analytics + CSV; no fake plays.

### Demo path

1. `npx tsx prisma/seed.ts` — ensures ACTIVE Mon–Fri 09:00–11:00 recurring + open hours.
2. Login **admin@adnabbit.com** / `admin123!` → **Analytics** (`/admin/analytics`).
3. Confirm non-empty **Schedule fill** summary, **Daypart heat** cyan cells Mon–Fri 09–10, **Campaign windows** rollup.
4. Export CSV: Fill / Daypart heat / Campaigns.
5. Login **demo.host@adnabbit.com** / `host123!` → `/host/analytics` — only Denver Peak Fitness screens.
6. Login **demo.advertiser@adnabbit.com** / `demo123!` → `/analytics` — own schedules only.
7. Plays panel shows **Awaits F2** (no invented counts).

### API smoke (session cookie)

```bash
# After browser login as admin, or use curl with next-auth session —
curl -s 'http://localhost:3000/api/admin/analytics/fill?range=7' | head
curl -s 'http://localhost:3000/api/admin/analytics/daypart-heat?range=7' | head
curl -s 'http://localhost:3000/api/admin/analytics/campaigns' | head
curl -s -o /tmp/fill.csv -w '%{http_code}' \
  'http://localhost:3000/api/admin/analytics/export.csv?table=fill&range=7'
# Host / advertiser hitting admin routes → 403
```

### Gaps

- force-live not historical
- F2 play persistence still stub
- Soft-miss charts (CSS heat table only)

---

## Ticket U — Download hours + fleet bulk (2026-09-26 MT)

**Goal:** Quiet hours gate player prefetch; admin bulk refresh/reboot/kiosk on fleet board.

### Download hours
1. `npx prisma migrate deploy` — applies `20260926200000_ticket_u_download_hours`.
2. Admin → Host detail → **Download hours** → set window that excludes now (e.g. Overnight 0–6 during daytime) → Save.
3. Player heartbeat/playlist shows `downloadAllowed: false`; logs `download quiet hours — deferring prefetch…`; status shows quiet hours (cache only).
4. Clear → **Allow anytime** → `downloadAllowed: true` again.

### Fleet bulk
1. `/admin/fleet` → select paired devices → **Refresh playlist** → per-device epoch bumps (offline → error, not all-or-nothing).
2. Select online devices → **Reboot…** → confirm → queues `reboot` via pendingInputJson.
3. Lock/Unlock kiosk likewise queues `setKiosk`.

### Gaps / soft miss
- Per-screen download override, bandwidth caps, host bulk, select-all filters beyond visible list

---

## Ticket V — Offline play policy (2026-09-26 MT)

**Goal:** Host offlinePolicy + cache TTL; player blackout or loop cache when API unreachable.

### Migrate
1. `npx prisma migrate deploy` — applies `20260926210000_ticket_v_offline_policy`.

### Happy path (PLAY_CACHE)
1. Admin → Host → Offline play policy = **Play cache**, TTL = **24** → Save.
2. Claim / heartbeat / playlist JSON includes `offlinePolicy: "PLAY_CACHE"`, `offlineCacheTtlHours: 24`.
3. Stop web API (or block network). After ~5 min grace: player status **Offline · playing cache**; items keep looping; play-logs muted.
4. Restart API → next heartbeat clears offline mode; playlist refreshes.

### BLACKOUT / TTL 0
1. Set policy **Blackout** (or TTL **0**) → Save.
2. Kill API → after grace: soft blackout screen (“Offline · soft blackout”); empty playlist; no PoP.
3. Fleet board offline card shows policy hint (“Offline · blackout” or “may play cache”).

### Soft miss
- Per-screen override, P2P, OptiSigns, new remote commands — deferred (Tickets W–Z held).
