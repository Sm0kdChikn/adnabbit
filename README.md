# AdNabbit Web MVP

Advertiser signup/login, creative upload (image/video), submit for review, admin approve/reject, **Ticket A — Host/screen inventory**, and **Ticket B — Advertiser public profiles**, and **Ticket C — Placement requests**, and **Ticket D — Scheduling**, and **Ticket E — Recurring dayparts**, and **Ticket E2 — Schedule calendar view**, and **Ticket G — Host self-serve portal**, and **Ticket J — device claim / playlist APIs**, and **Ticket K — admin folders**, and **Ticket O — playlist refresh**, and **Ticket P — admin remote view (screenshot relay)**, and **Ticket P.1 — admin remote mouse/keyboard control**, and **Ticket P.1.1 — kiosk lock/unlock toggle**, and **Ticket P.1.2 — admin device reboot**, and **Ticket Q — venue open hours / soft blackout / PoP mute**, and **Ticket R — fleet health + offline/empty alerts**, and **Ticket S — campaign windows + emergency take-down**, and **Ticket T — host / advertiser / admin analytics (schedule fill)**.

**Repo target:** https://github.com/Sm0kdChikn/adnabbit

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **NextAuth.js (Auth.js v4)** — Credentials provider, JWT sessions
- **Prisma** + **SQLite** (zero-setup local demo)
- Files stored on local disk under `uploads/`

## Auth model

- Email + password (bcrypt hashed)
- Roles: `ADVERTISER` (signup), `ADMIN` (seeded from env), `HOST` (admin-created / seeded, linked to a Host)
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

### Default seed demo host (Ticket G)

- Email: `demo.host@adnabbit.com`
- Password: `host123!`
- Linked venue: **Denver Peak Fitness** → `/host`

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

Extends Ticket D with weekly dayparts in the **host timezone** (screens inherit). No instance expansion DB rows, no OptiSigns. Calendar UI is Ticket E2. Overnight RECURRING dayparts are Ticket H.

### Data model (Pulse / Forge lock)

- **Host.timezone**: IANA string, default `America/Denver` (screens inherit; schedules evaluate overlap in this zone)
- **Schedule.kind**: `ONE_OFF` | `RECURRING`
  - **ONE_OFF**: `startAt` / `endAt` (absolute instants) — Ticket D behavior
  - **RECURRING**: `weekdays` (ISO Mon=1..Sun=7 CSV), `startTime` / `endTime` (`HH:mm`; same-day when `endTime > startTime`; overnight wrap when `endTime < startTime` — Ticket H; equal times rejected), `campaignStartDate` / `campaignEndDate` (`YYYY-MM-DD`, end ≥ start)
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
- **RECURRING:** for each visible day within `campaignStartDate`–`campaignEndDate` matching `weekdays`, block at `startTime`–`endTime` in host TZ (overnight: start→24:00 on D + 00:00→end on D+1 — Ticket H)
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



## Ticket G — Host self-serve portal

Hosts manage their own venue + screens without admin doing all inventory CRUD.

### Data model

- **User.role**: `ADVERTISER` | `ADMIN` | `HOST`
- **Host.userId**: optional unique FK → User (one login owns one Host for MVP; null = unclaimed; detach = set null)

### Host portal

| Path | Purpose |
|------|---------|
| `/host` | Own venue + screens list |
| `/host/edit` | Edit own Host (name, vertical, otherLabel, timezone, notes) |
| `/host/screens/new` | Create screen on own Host |
| `/host/screens/[id]` | Edit/delete own screen; read-only placements + schedules |
| GET/PATCH | `/api/host` |
| GET/POST | `/api/host/screens` |
| GET/PATCH/DELETE | `/api/host/screens/[id]` |

AuthZ: `host.userId === session.user.id`; screen CRUD only where `screen.hostId` matches. No approve/schedule mutate.

### Admin

| Path | Purpose |
|------|---------|
| `/admin/hosts/[id]` | Full CRUD + **Attach / Detach** owning HOST user (admin sets password; no invite email) |
| POST | `/api/admin/hosts/[id]/attach` body `{ email, password?, name? }` |
| POST | `/api/admin/hosts/[id]/detach` |

Admin still has unrestricted CRUD on all hosts/screens. ADVERTISER flows unchanged.

### Demo

1. Seed links `demo.host@adnabbit.com` / `host123!` → Denver Peak Fitness
2. Log in → `/host` → edit venue, add/edit screens
3. Admin → Hosts → Edit → Attach/Detach owner

## Ticket H — Calendar polish

Screen filter on schedule calendars + overnight (cross-midnight) RECURRING dayparts.

### Behavior

- **Screen filter:** `?screenId=` on `/admin/schedules/calendar` and `/schedules/calendar` (default All screens). Options derived from schedules already loaded (advertiser: only screens they see).
- **Overnight RECURRING:** `endTime < startTime` wraps (e.g. 22:00→02:00); equal times rejected; same-day still requires `endTime > startTime`. Stored as `HH:mm` strings.
- **Expand:** weekday applies to **start** day D → blocks `start→24:00` on D and `00:00→end` on D+1, clipped to calendar range (host TZ).
- **Overlap:** normalize overnight to `[start,1440)+[0,end)` before compare; warn-first vs same-screen ACTIVE (as before). ONE_OFF unchanged.

### Demo

1. Admin → Calendar → pick a screen in the Screen filter → URL keeps `?screenId=`
2. New RECURRING Fri 22:00→02:00 → calendar shows Fri evening + Sat morning blocks
3. Create overlapping ACTIVE on that screen → 409 warn-first


## Ticket J — Device claim, playlist, asset APIs

Software-first Linux kiosk player spike (companion repo: `Sm0kdChikn/adnabbit-player`). OptiSigns remains production PoP; play-logs are stub-only.

### Data model

- **Device**: 1:1 with Screen (`screenId` unique); stores **sha256** of bearer token only; `lastSeenAt`; **Ticket O** `playlistEpoch`; **Ticket P** `screenshotEpoch` / `screenshotCapturedEpoch` + single overwrite JPEG under `uploads/device-previews/{deviceId}.jpg`; **Ticket P.1** `pendingInputJson` remote-control queue; **Ticket Q** `playbackState` + `OpenHours` / `forceLiveUntil`; **Ticket R** `playerVersion` / optional `disk*` + `FleetAlert`; **Ticket S** take-down stamps on Creative/User/Host/Screen
- **ScreenClaim**: one-time 6–8 char codes from `A–Z0–9` excluding `0O1I`; TTL **15 minutes**; reminting a screen **supersedes** prior unused live codes

### Device APIs (Bearer device token)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/device/claim` | `{ code }` → `{ deviceToken, screenId, screenName, hostName, timezone }` |
| POST | `/api/device/heartbeat` | updates `lastSeenAt`; returns `playlistEpoch`, `screenshotEpoch`, `commands.captureScreenshot` |
| POST | `/api/device/screenshot` | Bearer; JPEG body (raw / multipart / base64); overwrite N=1 preview |
| GET | `/api/device/playlist` | ACTIVE schedules next **24h** (host TZ, overnight dayparts OK); includes `playlistEpoch` |
| GET | `/api/device/assets/[creativeId]` | stream upload for creatives on that screen |
| POST | `/api/device/play-logs` | **202 stub** — console log only, no DB persist |

### Admin / host UI

Screen detail pages (`/admin/screens/[id]`, `/host/screens/[id]`): **Mint claim code** + paired device last-seen + **Refresh playlist** (Ticket O). Admin also has **View screen** remote-view (Ticket P) + **Remote control** mouse/keyboard (Ticket P.1) + **Kiosk locked** toggle (Ticket P.1.1) + **Reboot device** (Ticket P.1.2).

Mint APIs: `POST /api/admin/screens/[id]/claim`, `POST /api/host/screens/[id]/claim`.

Refresh APIs: `POST /api/admin/screens/[id]/refresh-playlist`, `POST /api/host/screens/[id]/refresh-playlist` → `{ ok, playlistEpoch }` (409 if unpaired or lastSeenAt older than ~5 min).

### Seed

Includes APPROVED mp4 **Demo Player Spot** + ACTIVE ONE_OFF on **Lobby TV** covering ~next 48h.






## Ticket O — Force playlist refresh (web → player)

Admin/host **Refresh playlist** on screen detail bumps `Device.playlistEpoch`. Heartbeat and playlist GET return `playlistEpoch`; the player compares to its last seen epoch and calls `refreshPlaylist()` immediately (normal 30s poll / 60s heartbeat unchanged). No WebSockets (soft miss — polling is enough).

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/admin/screens/[id]/refresh-playlist` | Admin; requires paired + recently-seen device |
| POST | `/api/host/screens/[id]/refresh-playlist` | Host (own screens); same rules |
| POST | `/api/device/heartbeat` | `{ ok, lastSeenAt, screenId, playlistEpoch }` |
| GET | `/api/device/playlist` | includes `playlistEpoch` |

UI: `ClaimDevicePanel` — **Refresh playlist** next to mint (disabled if unpaired). 409 inline error when player offline.




## Ticket P — Admin remote view (screenshot relay)

**Option A (in-app):** Admin-only on-demand screenshot from a paired player. No WebRTC, no host remote-view UI. Mouse/keyboard is Ticket P.1 (below).

**Ops path B (not built in-app):** For true live **OS** remoting (outside the Electron window), use **Tailscale + wayvnc** (or similar) on the mini-PC — AdNabbit does not embed VNC/Wayland remoting.

**Out of scope / soft miss:** WebRTC (path C), host portal remote view, slow auto-poll is optional UI-only ("Live refresh").

### Flow

1. Admin **View screen** → `POST /api/admin/screens/[id]/remote-view` bumps `Device.screenshotEpoch` (requires paired + `lastSeenAt` within ~5 min).
2. Player heartbeat returns `commands.captureScreenshot: true` when `screenshotEpoch > screenshotCapturedEpoch`.
3. Electron `webContents.capturePage()` → JPEG → `POST /api/device/screenshot` (overwrite single blob).
4. Admin polls `GET /api/admin/screens/[id]/remote-view` (auth session; private short-cache / no-store) until 200 image or ~30s timeout.

### APIs

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/admin/screens/[id]/remote-view` | Admin; `{ ok, status: 'requested'|'ready', … }` |
| GET | `/api/admin/screens/[id]/remote-view` | Admin; JPEG bytes or 202 pending / 404 |
| POST | `/api/device/screenshot` | Device bearer; JPEG ≤ 2MB; sets `remoteViewCapturedAt` |
| POST | `/api/device/heartbeat` | includes `commands.captureScreenshot`, `commands.inputPending` |

UI: `RemoteViewPanel` on `/admin/screens/[id]` (below `ClaimDevicePanel`).

## Ticket P.1 — Admin remote mouse / keyboard control

Admin-only control of the **Electron player window** (not full OS). Builds on Ticket P remote view.

### Flow

1. Admin enables **Remote control** on the Remote view panel (after a preview is ready).
2. Clicks map from displayed `object-contain` size → natural JPEG / capture size → `POST /api/admin/screens/[id]/remote-control` (batched ~40ms).
3. Typing (while the preview surface is focused) forwards Enter / Escape / arrows / Backspace / Tab / printable chars; browser nav shortcuts are not forwarded.
4. Events append to `Device.pendingInputJson` (cap 64; paired + ~5 min freshness; admin role only).
5. Player polls `POST /api/device/input` every ~2s (and on heartbeat when `commands.inputPending`) → drains queue → `webContents.sendInputEvent`.
6. **Kiosk locked** toggle (Ticket P.1.1) queues `{ type: "command", name: "setKiosk", enabled: true|false }` (aliases: `enableKiosk` / `disableKiosk` / `exitKiosk`). Admin UI reflects the intended state after a successful queue. Player persists preference under `~/.adnabbit-player/preferences.json`.

### APIs

| Method | Path | Auth | Body / notes |
|--------|------|------|----------------|
| POST | `/api/admin/screens/[id]/remote-control` | Admin session | `{ events: [...] }` or `{ event }` or `{ command: "setKiosk"|"reboot"|"restartApp", enabled?: bool }` → `{ ok, queued, queueLength, dropped }` |
| POST | `/api/device/input` | Device Bearer | drains queue → `{ ok, events, drainedAt }` |
| POST | `/api/device/heartbeat` | Device Bearer | `commands.inputPending: true` when queue non-empty |

### Event shapes

```json
{ "type": "mouseClick", "x": 100, "y": 200, "button": "left", "clickCount": 1, "captureWidth": 1280, "captureHeight": 720 }
{ "type": "mouseMove", "x": 100, "y": 200, "captureWidth": 1280, "captureHeight": 720 }
{ "type": "keyDown", "keyCode": "Return", "modifiers": [] }
{ "type": "char", "keyCode": "a" }
{ "type": "command", "name": "setKiosk", "enabled": false }
{ "type": "command", "name": "exitKiosk" }
```

Mouse `x`/`y` are capture/native window coords. Player scales by `captureWidth`/`captureHeight` vs current `getContentSize()` when provided.

### Ticket P.1.1 — Kiosk lock / unlock

- **Unlock** (`setKiosk` `enabled: false` / `disableKiosk` / `exitKiosk`): player leaves Electron kiosk + fullscreen, windowed with chrome usable so Brandon can work on the mini-PC desktop around the player.
- **Lock** (`setKiosk` `enabled: true` / `enableKiosk`): restores kiosk + fullscreen lockdown.
- Preference persisted at `~/.adnabbit-player/preferences.json` (`kiosk: true|false`). `ADNNABIT_KIOSK=0` still wins at process start.
- Same safety as P.1: admin-only, paired device, ~5 min heartbeat freshness → otherwise 409.

### Ticket P.1.2 — Admin device reboot

- **Reboot device** button on Remote view (confirm dialog) queues `{ type: "command", name: "reboot" }` via the same `POST …/remote-control` path.
- Shorthand also accepted: `{ command: "reboot" }`.
- Player drains the queue, schedules a clean quit, then runs the `adnabbit-reboot` helper (systemd `systemctl reboot`). Requires the helper + polkit/sudoers NOPASSWD on the mini-PC (see player repo packaging).
- Secondary: `{ type: "command", name: "restartApp" }` relaunches the Electron process only (no OS reboot).
- Same gates: admin-only, paired, ~5 min freshness → **409** otherwise.
- Soft miss was process-only Restart; Brandon asked for full device reboot — reboot is the primary path.

### Limits

- Latency ≈ input poll (~2s), not WebRTC.
- Only the Electron BrowserWindow (ad UI), not the host OS desktop.
- No host-portal remote UI.



## Ticket K — Admin folders (hosts & advertisers)

Admin-only organizational folders scoped separately to **HOST** and **ADVERTISER**. Host and advertiser portals are unchanged (no folder UI).

### Schema

- **AdminFolder**: `scope` (`HOST`|`ADVERTISER`), `name`, `sortOrder`
- **AdminFolderItem**: `folderId`, `targetType`, `targetId`, `sortOrder`; unique `(targetType, targetId)` — each entity in at most one folder
- **Unfiled** = no `AdminFolderItem` row (no Unfiled folder row)
- Delete folder: transaction deletes items then folder (unfiles only — never deletes Host/User rows)
- Host delete cleans orphan `AdminFolderItem` rows

### APIs (admin session)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/folders?scope=` | List folders + items |
| POST | `/api/admin/folders` | `{ scope, name }` |
| PATCH | `/api/admin/folders/[id]` | Rename `{ name }` |
| DELETE | `/api/admin/folders/[id]` | Unfile items + delete folder |
| PATCH | `/api/admin/folders/reorder` | `{ scope, orderedIds }` |
| PATCH | `/api/admin/folders/items` | Move `{ targetType, targetId, folderId }` (`null` = unfile) or reorder `{ targetType, folderId, orderedTargetIds }` |

### UI

- `/admin/hosts` — folder sections + Unfiled; HTML5 drag-and-drop; list/grid ViewToggle
- `/admin/advertisers` — new page listing ADVERTISER users (email, name, creative counts) with same folder UI; linked in admin Nav

### Soft misses (later)

Deep nesting (>1 level), multi-select, mobile DnD polish, folder deep-links / search-within-folder.


## Ticket Q — Venue open hours / soft blackout / PoP mute

Hosts and admins set **weekly open/close** schedules per venue (Host), with optional **per-screen override**. Timezone = Host IANA zone.

| Piece | Behavior |
|-------|----------|
| Schema | `OpenHours` (scope HOST\|SCREEN, weekday 1–7, open/close HH:mm); `Screen.useCustomHours`, `Screen.forceLiveUntil`; `Device.playbackState` |
| Default | No hours rows → **always open** (legacy-safe) |
| Outside hours | Player **soft blackout** (black + idle); **no PoP** posts |
| Force live | Admin can set `forceLiveUntil` on a screen to bypass closed hours |
| Device APIs | `hours` payload on claim / heartbeat / playlist (includes `isOpenNow`, `nextOpenAt`/`nextCloseAt`, weekly) |
| Status | Admin Remote view + claim panel show **Closed hours** vs Offline vs Empty vs Live |
| Hard off | Stubbed / TODO (CEC/DPMS) |

**UI:** Host `/host/edit` (venue hours) + `/host/screens/[id]` (override); Admin `/admin/hosts/[id]` + `/admin/screens/[id]` (override + force-live).

**Player:** checks schedule every minute + on playlist tick; caches hours for offline enforcement.


## Ticket R — Fleet health + offline / empty alerts

Admin fleet board for **paired** screens + in-app alerts. Host sees online/last-seen on own screens only (no alert inbox).

| Piece | Behavior |
|-------|----------|
| Online | `Device.lastSeenAt` within **5 min** (`PLAYER_ONLINE_GRACE_MS`) |
| Empty | `playbackAllowed` (`hours.isOpenNow` / force-live) **and** 0 active playlist items (same windows as device playlist API). **Never** during CLOSED_HOURS |
| Status | Reuses Ticket Q `deriveDeviceDisplayStatus` / `DeviceStatusBadge` |
| Player version | Heartbeat may send `playerVersion` (player package version). Lag vs `ADNNABIT_LATEST_PLAYER_VERSION` env is soft-miss |
| Disk | Optional `diskFreeBytes` / `diskTotalBytes` on heartbeat; critical only when reported. Otherwise "—" / TODO (no fake metrics) |
| Alerts | Persisted `FleetAlert` (OFFLINE \| EMPTY); one OPEN per `(screen, kind)` until auto-resolved or manual resolve. Email/SMS later TODO |

### Schema

- `Device.playerVersion`, `diskFreeBytes`, `diskTotalBytes` (nullable)
- `FleetAlert`: `screenId`, `kind`, `status` OPEN\|RESOLVED, `message`, `openedAt`, `resolvedAt`

### APIs (admin session)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/fleet?filter=&scan=` | Health list + counts; `scan=1` runs alert sync |
| POST | `/api/admin/fleet` | Cron/poll hook — create/resolve alerts |
| GET | `/api/admin/alerts?status=&count=` | Alert list or `{ openCount }` |
| POST | `/api/admin/alerts/[id]/resolve` | Manual resolve |

### UI

- `/admin/fleet` — filters All / Offline / Empty / Version / Attention
- `/admin/alerts` — open/resolved list + Resolve
- Admin nav: **Fleet**, **Alerts** (+ badge count)
- Host `/host` — Online/Offline/Unpaired + last seen on each screen card

### Soft misses

Disk free reporting from player, version-lag vs GitHub releases, email alerts, host alert inbox, auto-remediation.

## Ticket S — Campaign windows + emergency take-down

Campaign play windows reuse **Schedule** fields from Ticket E (`startAt`/`endAt` ONE_OFF; `campaignStartDate`/`campaignEndDate` RECURRING). Outside the window → omitted from device playlists (same as daypart miss). Advertiser schedule UI stays **read-only**; admin sets windows.

| Piece | Behavior |
|-------|----------|
| Creative take-down | `takenDownAt` / `takenDownById` / `takenDownReason` — excluded from all playlists |
| Advertiser take-down | `User.advertiserTakenDownAt` (+ by/reason) — all their creatives excluded |
| Host / screen soft kill | `playbackTakenDownAt` (+ by/reason) — paid playlist empty for that host's screens or one screen (idle/black OK) |
| Undo | Clear stamp → restores if still APPROVED and in schedule window |
| Epoch | Take-down / clear bumps `playlistEpoch` on every affected Device |
| UI | Admin confirm on creative (review queue + advertiser detail), advertiser detail, host/screen detail; Active/Scheduled/Expired window badges |

### APIs (admin session)

| Method | Path | Body |
|--------|------|------|
| POST | `/api/admin/creatives/[id]/take-down` | `{ reason?, undo? }` |
| POST | `/api/admin/advertisers/[id]/take-down` | `{ reason?, undo? }` |
| POST | `/api/admin/hosts/[id]/take-down` | `{ reason?, undo? }` |
| POST | `/api/admin/screens/[id]/take-down` | `{ reason?, undo? }` |

### Soft misses

Full audit log table, email alerts, host self-serve take-down of others' ads.


## Ticket T — Analytics (schedule fill / daypart / campaigns)

Marketplace analytics from **OpenHours + ACTIVE schedule expansion** (same truth as the playlist builder). **Does not invent play counts.** Device play-logs remain F2 stub; OptiSigns Looker stays production PoP.

| Slice | Meaning |
|-------|---------|
| Schedule fill | Per screen/day: open / paid (union) / empty-while-open / closed minutes + paid item count |
| Daypart heat | Weekday × hour grid of *scheduled* paid minutes (host TZ), summed across the date range |
| Campaign windows | Active / Scheduled / Expired (+ Draft / Cancelled) via `scheduleWindowPhase` |
| Plays panel | Soft miss — labeled **Awaits F2** |

### Pages

| Role | Path |
|------|------|
| Admin | `/admin/analytics` |
| Host | `/host/analytics` (own venue screens only) |
| Advertiser | `/analytics` (own creatives/schedules only) |

Date range: last 7 / 30 days / custom. Filters: host / screen / advertiser (admin). CSV export for fill, daypart, campaigns.

### APIs

| Method | Admin | Host | Advertiser |
|--------|-------|------|------------|
| GET fill | `/api/admin/analytics/fill` | `/api/host/analytics/fill` | `/api/analytics/fill` |
| GET daypart-heat | `/api/admin/analytics/daypart-heat` | `/api/host/analytics/daypart-heat` | `/api/analytics/daypart-heat` |
| GET campaigns | `/api/admin/analytics/campaigns` | `/api/host/analytics/campaigns` | `/api/analytics/campaigns` |
| GET export.csv | `/api/admin/analytics/export.csv?table=fill\|daypart\|campaigns` | `/api/host/analytics/export.csv?…` | `/api/analytics/export.csv?…` |

Query: `range=7\|30\|custom`, `from`, `to`, `hostId`, `screenId`, `advertiserId`. Cross-role access → **403**.

### Soft misses / limitations

- force-live overrides are **not** replayed historically (configured hours only).
- Overlapping schedules: paid minutes use **union** coverage within open hours.
- No email digests, billing fill-vs-paid, websockets, or chart libraries.

## Out of scope (later tickets)


- OptiSigns sync (beyond PoP import), F2 play-log persistence, custom ISO, marketplace matching, billing, digests, drag-drop calendar edit, multi-screen assign, monthly RRULE, host invites/payouts, full-OS VNC/WebRTC remoting (use Tailscale + wayvnc; P.1 is Electron-window only)

## Push to GitHub

Leave commits for Cron; do not force-push. Local tree should be ready to commit.

(Do not commit `.env`, `uploads/*`, or `*.db` — already gitignored.)
