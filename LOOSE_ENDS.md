# AdNabbit — loose ends (Ticket BH 2026-09-26 ~10:30 PM MT)

Bug-hunt harden pass after F2. P0/P1 fixed in-ticket; items below are **parked** (not started) or soft misses.

## Fixed this pass (BH)

- **Q.1 overnight wrap (P0):** `open-hours` validation + `evaluateOpenState` / `findNextTransition` allow `close < open` (wrap midnight). Player `evaluateHours` mirrors. Equal times still rejected. DownloadHours inherits via shared validator/eval.
- **F2 smoke:** persist / duplicate / mute (closed hours, maintenance, take-down) verified against local web; no P0/P1 defects found.
- **Regression:** playlistEpoch on take-down, DownloadHours overnight, offline PLAY_CACHE/BLACKOUT, maintenance beats force-live, fleet + device groups, setOutput queue — PASS.

## Smoke (this pass)

| Check | Result |
|-------|--------|
| `npx tsx scripts/bh-overnight-smoke.ts` (web) | PASS |
| `node scripts/bh-overnight-smoke.js` (player) | PASS |
| `npx tsx scripts/bh-f2-regression-smoke.ts` | PASS (46 asserts) |
| Lobby TV cold boot / autologin / real reboot | **SOFT MISS** — no hardware on box (checklist in SMOKE.md Ticket BH) |

## Parked / soft misses

| Item | Sev | Repro / notes |
|------|-----|----------------|
| Lobby P.1.2/P.1.3 soak | soft miss | Needs Lobby mini-PC: AppImage ≥0.3.5, claim, reboot, autologin, playlist, F2 PlayLog row — see SMOKE.md BH checklist |
| Full host-TZ matrix for overnight | soft miss | Out of BH; verify critical venues manually if TZ ≠ America/Denver |
| UI polish | next ticket | Brandon order: F2 → BH → UI polish — do not start |
| OptiSigns cutover / deploy-to-prod | out | Explicitly out of BH |
| Hard display-off (CEC/DPMS) | backlog | Still stubbed under Ticket Q |
| Player cursor hide on some Linux WMs | soft miss | Player README |
| Durable offline play-log queue | soft miss | F2 out |

## Prior parked (unchanged)

- Stripe Connect / Ticket M (Brandon sequencing)
- Postgres cutover
- Custom ISO / deep OS lockdown beyond P.1.3 autostart
- Deep nesting folders, multi-select, mobile DnD polish

## Repos

- Web: `Sm0kdChikn/adnabbit` (`/workspace/adnabbit-web`)
- Player: `Sm0kdChikn/adnabbit-player` (`/workspace/adnabbit-player`) — v0.3.5 overnight mirror
