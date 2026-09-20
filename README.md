# AdNabbit Web MVP

Advertiser signup/login, creative upload (image/video), submit for review, admin approve/reject, **Ticket A — Host/screen inventory**, and **Ticket B — Advertiser public profiles**, and **Ticket C — Placement requests**, and **Ticket D — Scheduling**, and **Ticket E — Recurring dayparts**, and **Ticket E2 — Schedule calendar view**.

**Repo target:** https://github.com/Sm0kdChikn/adnabbit

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **NextAuth.js (Auth.js v4)** — Credentials provider, JWT sessions
- **Prisma** + **SQLite** (zero-setup local demo)
- Files stored on local disk under `uploads/`

## Auth model

- Email + password (bcrypt hashed)
- Roles: `ADVERTISER` (signup) and `ADMIN` (seeded from env)
- Session strategy: JWT via NextAuth
- Admin-only routes reuse the same `role === "ADMIN"` gate as creative approve/reject

## Quick start

```bash
cd adnabbit-web
cp .env.example .env   # or use the included .env for local demo
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open http://localhost:3000

### Default seed admin (from `.env`)

- Email: `admin@adnabbit.com`
- Password: `admin123!`

Change `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding in non-dev environments.

Seed also creates sample **hosts** / **screens** (Ticket A), a **published demo advertiser profile** at `/a/front-range-hvac` (Ticket B), an **APPROVED** creative + placement (Ticket C), **ONE_OFF sample schedules** (Ticket D), and a **RECURRING Mon–Fri 09:00–11:00 daypart** (Ticket E).

### Default seed demo advertiser

- Email: `demo.advertiser@adnabbit.com`
- Password: `demo123!`
- Public profile: http://localhost:3000/a/front-range-hvac

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run db:migrate` | Prisma migrate (interactive) |
| `npm run db:push` | Push schema without migration history |
| `npm run db:seed` | Create/update ADMIN + hosts/screens (w/ timezone) + demo profile + APPROVED creative/placement + ONE_OFF + RECURRING schedules |
| `npm run build` / `start` | Production build & serve |

## Creative statuses

`DRAFT` → (submit) → `PENDING` → (admin) → `APPROVED` or `REJECTED`

- Reject requires a reason; advertisers see it on their dashboard
- Rejected creatives can be re-submitted

## Ticket A — Host / screen inventory

Admin-only CRUD for venues (hosts) and screens.

### Data model

- **Host**: `name`, required `vertical` (Forge enum below), optional `otherLabel` **iff** `vertical === OTHER`, `timezone` (IANA, default `America/Denver`; screens inherit), optional `notes`
- **Screen**: `name`, `city`, `zip`, `inventoryStatus` (`OPEN` | `LIMITED` | `FULL`), optional `notes`, `hostId`
- Screens **do not** store vertical — join `Screen.host.vertical`

### Host vertical enum (Forge lock)

`RESTAURANT_FB`, `SPORTS_BAR`, `GYM`, `AUTO`, `MEDICAL_DENTAL`, `SALON_SPA`, `RETAIL`, `GROCERY`, `WAITING_ROOM`, `HOTEL`, `EDUCATION`, `PROFESSIONAL`, `GAS_TRAVEL`, `CHURCH_COMMUNITY`, `AIRPORT_TRANSIT`, `OTHER`

### Admin UI

| Path | Purpose |
|------|---------|
| `/admin/hosts` | List hosts |
| `/admin/hosts/new` | Create host |
| `/admin/hosts/[id]` | Edit/delete host + list its screens |
| `/admin/screens` | List screens; filter by city, zip, inventory status, host vertical |
| `/admin/screens/new` | Create screen |
| `/admin/screens/[id]` | Edit/delete screen |

### Admin APIs

| Method | Path |
|--------|------|
| GET/POST | `/api/admin/hosts` |
| GET/PATCH/DELETE | `/api/admin/hosts/[id]` |
| GET/POST | `/api/admin/screens` (GET query: `city`, `zip`, `inventoryStatus`, `vertical`) |
| GET/PATCH/DELETE | `/api/admin/screens/[id]` |

Non-admins receive `401`/`403` on APIs and are redirected away from admin pages.


## Ticket B — Advertiser public profiles

Shareable public pages at `/a/[slug]`. Advertisers edit their own profile; admins can unpublish.

### Data model

- **AdvertiserProfile** (1:1 with `User`): `slug` (unique, URL-safe), `displayName`, `pitch`, `website`, `contact` (phone or email), `logoStoredName` (upload) and/or `logoUrl` (external), `category`, `serviceAreaZips` (CSV/free-form), `published` (bool)
- Slug is derived from business name with collision suffixes (`-1`, `-2`, …)

### Advertiser UI / API

| Path | Purpose |
|------|---------|
| `/profile` | Create/edit own profile + publish toggle |
| GET/PUT | `/api/profile` (advertiser only; PUT accepts JSON or multipart for logo upload) |

### Public

| Path | Purpose |
|------|---------|
| `/a/[slug]` | Public profile — **published only**; unpublished → soft “not available” |

### Admin

| Path | Purpose |
|------|---------|
| `/admin/profiles` | List all profiles; **Unpublish** action |
| GET | `/api/admin/profiles` |
| POST | `/api/admin/profiles/[id]/unpublish` |

### Demo

After seed: log in as `demo.advertiser@adnabbit.com` / `demo123!` → Profile, or open `/a/front-range-hvac` anonymously.

## Uploads

- Allowed: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/webm`
- Max size: 50 MB
- Stored under project `uploads/`
- Served via authenticated `/api/uploads/[storedName]`

## Switching to Postgres

1. In `prisma/schema.prisma`, set provider to `postgresql`
2. Set `DATABASE_URL` accordingly
3. `npx prisma migrate dev` + `npm run db:seed`

## Ticket C — Placement requests

Advertisers browse requestable screens (OPEN / LIMITED), attach an **APPROVED** creative, and submit a placement request. Admins approve or reject (reject requires a reason shown to the advertiser).

### Data model (Forge lock)

- **PlacementRequest**: `advertiserId` → User, `screenId` → Screen, `creativeId` → Creative, `status` (`REQUESTED` | `APPROVED` | `REJECTED`), optional `rejectReason`, optional `note` (advertiser message), `reviewedAt`, `reviewedById` → User, timestamps
- Indexes: `status`, `advertiserId`, `screenId` (also `creativeId`)
- Create rules: creative owned by requester **and** status `APPROVED`; screen inventory `OPEN` or `LIMITED` (FULL not requestable). Duplicate pending same creative+screen → 409.

### Advertiser UI / API

| Path | Purpose |
|------|---------|
| `/screens` | Browse OPEN/LIMITED (optional include FULL as unavailable); filters: city, zip, host vertical, venue/notes search |
| `/placements` | Own placement requests + status (+ reject reason) |
| GET | `/api/screens` (query: `city`, `zip`, `vertical`, `q`, `includeFull`, `inventoryStatus`) |
| GET/POST | `/api/placements` (POST body: `screenId`, `creativeId`, optional `note`) |

### Admin

| Path | Purpose |
|------|---------|
| `/admin/placements` | Queue REQUESTED; approve / reject with reason |
| GET | `/api/admin/placements` (query: `status`, default `REQUESTED`; `ALL` for all) |
| POST | `/api/admin/placements/[id]/approve` |
| POST | `/api/admin/placements/[id]/reject` body `{ "reason": "…" }` |

### Demo

1. Log in as `demo.advertiser@adnabbit.com` / `demo123!` (seeded APPROVED creative)
2. **Screens** → filter Denver → Request placement → pick Demo Approved Banner
3. Log in as admin → **Placements** → Approve or Reject with reason
4. Back as advertiser → **Placements** → see status / reject reason

## Ticket D — Scheduling

Admin creates play windows for **APPROVED** placements. Advertisers view their own schedules read-only. No OptiSigns push / proof-of-play in MVP.

### Data model (Pulse / Forge lock)

- **Schedule**: `placementId` → PlacementRequest (many schedules per placement OK), cached `screenId` (from placement, for indexes/overlap), `startAt`, `endAt`, `status` (`DRAFT` | `ACTIVE` | `ENDED` | `CANCELLED`), optional `note`, `createdById` → admin User, optional `cancelledAt`, timestamps
- Indexes: `status`, `startAt`, `endAt`, `placementId`, `screenId`
- Rules: only APPROVED placements; `endAt > startAt`; admin mutate; advertiser read-only own
- Overlap: **warn-first** on same-screen overlapping **ACTIVE** (409 + `requireAcknowledge`; client can retry with `acknowledgeOverlap: true`) — not a hard block
- `ACTIVE` → `ENDED` materialised on list/read when `endAt < now`

### Admin UI / API

| Path | Purpose |
|------|---------|
| `/admin/schedules` | List; filter by screen, status, date range (`from`/`to`) |
| `/admin/schedules/new` | Create from APPROVED placement |
| `/admin/schedules/[id]` | Edit times / DRAFT or ACTIVE / note; cancel |
| GET/POST | `/api/admin/schedules` (GET query: `screenId`, `status`, `from`, `to`, `placementId`) |
| GET/PATCH | `/api/admin/schedules/[id]` |
| POST | `/api/admin/schedules/[id]/cancel` |

### Advertiser

| Path | Purpose |
|------|---------|
| `/schedules` | Own schedules (read-only) |
| GET | `/api/schedules` |

### Demo

1. Seed creates ACTIVE + DRAFT schedules for demo advertiser’s APPROVED placement
2. Admin → **Schedules** → New / Edit / Cancel
3. `demo.advertiser@adnabbit.com` → **Schedules** → see windows


## Ticket E — Recurring dayparts

Extends Ticket D with weekly dayparts in the **host timezone** (screens inherit). No instance expansion DB rows, no overnight spans, no OptiSigns. Calendar UI is Ticket E2.

### Data model (Pulse / Forge lock)

- **Host.timezone**: IANA string, default `America/Denver` (screens inherit; schedules evaluate overlap in this zone)
- **Schedule.kind**: `ONE_OFF` | `RECURRING`
  - **ONE_OFF**: `startAt` / `endAt` (absolute instants) — Ticket D behavior
  - **RECURRING**: `weekdays` (ISO Mon=1..Sun=7 CSV), `startTime` / `endTime` (`HH:mm`, same-day, `endTime > startTime`, **no overnight**), `campaignStartDate` / `campaignEndDate` (`YYYY-MM-DD`, end ≥ start)
- Status unchanged: `DRAFT` | `ACTIVE` | `ENDED` | `CANCELLED`; cancel; `ACTIVE` → `ENDED` when ONE_OFF `endAt` passed or RECURRING `campaignEndDate` < today in host TZ
- Only **APPROVED** placements; admin mutate; advertiser read-only
- Overlap: **warn-first** on same-screen **ACTIVE** across kinds — date∩ + weekday∩ + time∩ in host TZ (409 + `requireAcknowledge`; retry with `acknowledgeOverlap: true`)

### Admin / advertiser

Same paths as Ticket D (`/admin/schedules`, `/schedules`, APIs). Create/edit forms toggle ONE_OFF vs RECURRING. Host create/edit includes timezone.

### Demo

1. Seed creates ACTIVE RECURRING Mon–Fri 09:00–11:00 + ONE_OFF samples
2. Admin → **Schedules** → New → kind RECURRING → Mon–Fri 09:00–11:00 → Cancel
3. `demo.advertiser@adnabbit.com` → **Schedules** → see daypart summary



## Ticket E2 — Schedule calendar view

Client-side expand of schedules into **week / month** calendar blocks in each screen’s **host timezone** (`date-fns` + `date-fns-tz`). No schema change; no `ScheduleInstance` rows; no drag-drop edit; no OptiSigns.

### Behavior

- **Views:** week (Mon–Sun time grid) and month (day cells); toggle via `?view=week|month` (default week)
- **Anchor:** `?date=YYYY-MM-DD` (host-local “today” default)
- **Default statuses:** ACTIVE + DRAFT; CANCELLED/ENDED hidden unless “Show CANCELLED / ENDED” or status filter
- **ONE_OFF:** per-day segments from `startAt`–`endAt` in host TZ
- **RECURRING:** for each visible day within `campaignStartDate`–`campaignEndDate` matching `weekdays`, block at `startTime`–`endTime` in host TZ
- **Click (admin):** `/admin/schedules/[id]`
- **Advertiser:** same expand, read-only (no detail link)

### Paths

| Path | Purpose |
|------|---------|
| `/admin/schedules/calendar` | Admin week/month calendar |
| `/schedules/calendar` | Advertiser read-only calendar |
| `/admin/schedules`, `/schedules` | Existing list views (unchanged) |

### Demo

1. Seed → ACTIVE RECURRING Mon–Fri 09:00–11:00 (+ ONE_OFF samples)
2. Admin → **Calendar** → week view (use `?date=` on a weekday inside the campaign if today is outside Mon–Fri span) → Mon–Fri 09–11 blocks
3. Click block → schedule detail
4. `demo.advertiser@adnabbit.com` → **Calendar** → same expand, read-only

## Out of scope (later tickets)

- Host self-serve portal, player, OptiSigns sync, proof-of-play, marketplace, billing, drag-drop calendar edit, multi-screen assign, monthly RRULE, overnight dayparts

## Push to GitHub

Leave commits for Cron; do not force-push. Local tree should be ready to commit.

(Do not commit `.env`, `uploads/*`, or `*.db` — already gitignored.)
