# AdNabbit — loose ends (QA pass 2026-09-25 ~8:16 PM MT)

Post–Ticket L cleanup. High-confidence fixes landed in this pass; everything below is **intentionally parked** (not started).

## Fixed this pass

- **Claim remint:** minting a new code for a screen now **supersedes** any still-live unused codes (sets `expiresAt` to now). Previously admin + host remints left multiple valid codes.
- **Claim TTL boundary:** device claim treats `expiresAt <= now` as expired (was strict `<`).

## Smoke (this pass)

| Check | Result |
|-------|--------|
| `npm run build` + `npm run lint` (web) | PASS |
| Player JS syntax (`node --check`) | PASS (no build script) |
| Landing / login / admin+host portals | PASS |
| Admin folders API HOST/ADVERTISER | PASS |
| Device claim → heartbeat → playlist → cache → play-logs stub | PASS |
| Host authz on `/admin/*` (307→`/host`) + admin APIs 403 | PASS |

## Parked for Brandon / later tickets

### Ticket M (next) — Stripe Connect
Brandon: **Stripe Connect before advertisers can submit ads.** Out of scope for this QA pass — do not start here.

### Explicitly out of scope (prior tickets)
- **F2** — play-log persistence (device `/api/device/play-logs` stays 202 stub)
- Postgres cutover / production deploy
- Custom ISO, fleet management, OptiSigns cutover
- Full **OS lockdown** (Electron kiosk only; see player README soft miss)
- Deep nesting folders, multi-select, mobile DnD polish, folder deep-links / search-within-folder

### Soft misses / backlog (no blocker)

| Item | Notes |
|------|--------|
| `cleanupAdvertiserFolderItem` | Exported from `src/lib/folders.ts` but unused — no advertiser-user delete path yet |
| Empty `adnabbit-player/scripts/` | Placeholder dir; no scripts |
| Web README drift | No dedicated Ticket L section; cinematic landing + list/grid mostly covered under K / UX commits |
| Player cursor hide | Soft miss on some Linux WMs (documented in player README) |
| Headless play-log when playlist empty | Posts `creativeId: undefined`; stub still 202 — fine until F2 |
| Reclaim invalidates prior device token | By design (`deleteMany` then create); old player token → 401 until re-claim |
| Demo-shots / untracked PNGs | Local only; do not commit |

## Repos

- Web: `Sm0kdChikn/adnabbit` (`/workspace/adnabbit-web`)
- Player: `Sm0kdChikn/adnabbit-player` (`/workspace/adnabbit-player`) — no code changes this pass
