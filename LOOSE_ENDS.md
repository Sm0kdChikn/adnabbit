# AdNabbit — loose ends (Ticket UP 2026-09-26 ~10:45 PM MT)

UI polish after BH. Polish-only; no schema/API/feature work.

## Done this pass (UP)

- Shared status chips + EmptyState consolidation (admin/host/advertiser charcoal/cyan)
- Fleet + Remote denser status chip rows
- Analytics Scheduled vs Played (F2) labels + empty Plays copy
- Form panel chrome alignment (hours / download / offline / maintenance / output / take-down)

## Soft misses (UP)

| Item | Sev | Notes |
|------|-----|-------|
| Mobile layout polish | soft miss | Explicit Pulse soft miss |
| Dark-mode novelty | soft miss | Tokens already theme-aware; no novelty pass |
| Full redesign | soft miss | Out |
| Exhaustive EmptyState on every legacy dashed box | soft miss | Analytics + primary lists done |
| Fleet volume/brightness chips | soft miss | Not on `FleetScreenHealth` wire |

## Prior (BH) parked / soft misses

| Item | Sev | Repro / notes |
|------|-----|----------------|
| Lobby P.1.2/P.1.3 soak | soft miss | Needs Lobby mini-PC — see SMOKE.md BH checklist |
| Full host-TZ matrix for overnight | soft miss | Verify critical venues if TZ ≠ America/Denver |
| OptiSigns cutover / deploy-to-prod | out | Explicitly out |
| Hard display-off (CEC/DPMS) | backlog | Still stubbed under Ticket Q |
| Player cursor hide on some Linux WMs | soft miss | Player README |
| Durable offline play-log queue | soft miss | F2 out |

## Prior parked (unchanged)

- Stripe Connect / Ticket M (Brandon sequencing)
- Postgres cutover
- Custom ISO / deep OS lockdown beyond P.1.3 autostart
- Deep nesting folders, multi-select, mobile DnD polish

## Repos

- Web: `Sm0kdChikn/adnabbit` (`/workspace/adnabbit-web`) — Ticket UP
- Player: `Sm0kdChikn/adnabbit-player` (`/workspace/adnabbit-player`) — **N/A** (no change)
