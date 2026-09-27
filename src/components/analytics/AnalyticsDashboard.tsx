import { Suspense } from "react";
import {
  type CampaignRollup,
  type DaypartHeatResult,
  type DateRange,
  type FillRow,
  type FillSummary,
  type PlayRow,
  type PlaysSummary,
  WEEKDAY_LABELS,
} from "@/lib/analytics";
import { WindowPhaseBadge } from "@/components/StatusBadge";
import { StatusChip } from "@/components/StatusBadge";
import {
  EmptyState,
  PageHeader,
  SectionTitle,
  StatPill,
  StatRow,
} from "@/components/ui";
import { AnalyticsFilters } from "./AnalyticsFilters";

function fmtDurMs(ms: number): string {
  if (ms <= 0) return "0s";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const r = sec % 60;
  if (min < 60) return r ? `${min}m ${r}s` : `${min}m`;
  const h = Math.floor(min / 60);
  const mr = min % 60;
  return mr ? `${h}h ${mr}m` : `${h}h`;
}

function fmtMin(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }
  return `${m}m`;
}

function heatColor(minutes: number, max: number): string {
  if (minutes <= 0 || max <= 0) return "transparent";
  const t = Math.min(1, minutes / max);
  // cyan accent ramp on charcoal
  const alpha = 0.12 + t * 0.78;
  return `rgba(34, 211, 238, ${alpha})`;
}

type Option = { id: string; label: string };

export function AnalyticsDashboard({
  title,
  description,
  basePath,
  exportBase,
  range,
  fillSummary,
  fillRows,
  heat,
  campaigns,
  playsSummary,
  playRows = [],
  hosts = [],
  screens = [],
  advertisers = [],
  showHostFilter = false,
  showScreenFilter = true,
  showAdvertiserFilter = false,
}: {
  title: string;
  description: string;
  basePath: string;
  exportBase: string;
  range: DateRange;
  fillSummary: FillSummary;
  fillRows: FillRow[];
  heat: DaypartHeatResult;
  campaigns: CampaignRollup;
  playsSummary: PlaysSummary;
  playRows?: PlayRow[];
  hosts?: Option[];
  screens?: Option[];
  advertisers?: Option[];
  showHostFilter?: boolean;
  showScreenFilter?: boolean;
  showAdvertiserFilter?: boolean;
}) {
  const maxHeat = Math.max(
    1,
    ...heat.grid.slice(1).flatMap((row) => row)
  );
  // Show denser fill table: collapse to latest 14 screen-days with activity first, else first 40
  const activeRows = fillRows.filter(
    (r) => r.paidMinutes > 0 || r.openMinutes > 0
  );
  const displayRows =
    activeRows.length > 0
      ? activeRows.slice(0, 80)
      : fillRows.slice(0, 40);

  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />

      <Suspense fallback={null}>
        <AnalyticsFilters
          basePath={basePath}
          exportBase={exportBase}
          hosts={hosts}
          screens={screens}
          advertisers={advertisers}
          showHostFilter={showHostFilter}
          showScreenFilter={showScreenFilter}
          showAdvertiserFilter={showAdvertiserFilter}
        />
      </Suspense>

      <p className="text-xs text-muted">
        Range <span className="text-foreground">{range.fromYmd}</span> →{" "}
        <span className="text-foreground">{range.toYmd}</span>
        {range.preset !== "custom" ? (
          <span className="text-muted-strong"> (last {range.preset} days)</span>
        ) : null}
        .{" "}
        <span className="text-foreground">Scheduled</span> = open hours + ACTIVE
        schedules (fill / heat / campaigns).{" "}
        <span className="text-foreground">Played (F2)</span> = first-party{" "}
        <code className="text-muted-strong">PlayLog</code> device counts.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="neutral">Scheduled — fill / heat / campaigns</StatusChip>
        <StatusChip tone="success">Played (F2) — device PlayLog</StatusChip>
      </div>

      <section className="space-y-3">
        <SectionTitle>Scheduled — fill</SectionTitle>
        <StatRow className="lg:grid-cols-4">
          <StatPill
            label="Paid minutes"
            value={fmtMin(fillSummary.totalPaidMinutes)}
          />
          <StatPill
            label="Empty while open"
            value={fmtMin(fillSummary.totalEmptyWhileOpenMinutes)}
          />
          <StatPill
            label="Closed / blackout"
            value={fmtMin(fillSummary.totalClosedMinutes)}
          />
          <StatPill
            label="Avg fill %"
            value={
              fillSummary.avgFillPct == null
                ? "—"
                : `${fillSummary.avgFillPct}%`
            }
          />
        </StatRow>

        {displayRows.length === 0 ? (
          <EmptyState>No screen/day rows in range for Scheduled fill.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-background-elevated text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Screen</th>
                  <th className="px-3 py-2">Host</th>
                  <th className="px-3 py-2 text-right">Open</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-right">Empty</th>
                  <th className="px-3 py-2 text-right">Closed</th>
                  <th className="px-3 py-2 text-right">Items</th>
                  <th className="px-3 py-2 text-right">Fill %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayRows.map((r) => (
                  <tr
                    key={`${r.screenId}:${r.dayYmd}`}
                    className="hover:bg-background-elevated"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-muted">
                      {r.dayYmd}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {r.screenName}
                      {r.takenDown ? (
                        <StatusChip tone="danger" className="ml-2 !text-[10px]">
                          take-down
                        </StatusChip>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted">{r.hostName}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {fmtMin(r.openMinutes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-accent">
                      {fmtMin(r.paidMinutes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {fmtMin(r.emptyWhileOpenMinutes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-strong">
                      {fmtMin(r.closedMinutes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {r.paidItems}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {r.fillPct == null ? "—" : `${r.fillPct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fillRows.length > displayRows.length ? (
              <p className="border-t border-border px-3 py-2 text-xs text-muted">
                Showing {displayRows.length} of {fillRows.length} screen-days.
                Export CSV for full Looker-friendly dump.
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Scheduled — daypart heat</SectionTitle>
        <p className="text-xs text-muted">
          Scheduled paid minutes by weekday × hour (host TZ; hint{" "}
          <span className="text-foreground">{heat.timezoneHint}</span>). Total{" "}
          <span className="text-accent">{fmtMin(heat.totalMinutes)}</span> in
          range.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface p-3 shadow-sm">
          <table className="min-w-full border-separate border-spacing-0.5 text-center text-[10px]">
            <thead>
              <tr>
                <th className="px-1 py-1 text-left text-muted">Day</th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="w-7 px-0.5 py-1 font-normal text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
                <tr key={wd}>
                  <td className="whitespace-nowrap px-1 py-0.5 text-left text-xs text-muted">
                    {WEEKDAY_LABELS[wd]?.slice(0, 3) || wd}
                  </td>
                  {Array.from({ length: 24 }, (_, h) => {
                    const m = heat.grid[wd][h];
                    return (
                      <td
                        key={h}
                        title={`${WEEKDAY_LABELS[wd]} ${String(h).padStart(2, "0")}:00 — ${m} min`}
                        className="h-6 w-7 rounded-sm border border-border/40"
                        style={{ backgroundColor: heatColor(m, maxHeat) }}
                      >
                        <span className="sr-only">{m}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Scheduled — campaign windows</SectionTitle>
        <StatRow className="lg:grid-cols-5">
          <StatPill label="Active" value={campaigns.counts.ACTIVE || 0} />
          <StatPill label="Scheduled" value={campaigns.counts.SCHEDULED || 0} />
          <StatPill label="Expired" value={campaigns.counts.EXPIRED || 0} />
          <StatPill label="Draft" value={campaigns.counts.DRAFT || 0} />
          <StatPill label="Cancelled" value={campaigns.counts.CANCELLED || 0} />
        </StatRow>
        {campaigns.rows.length === 0 ? (
          <EmptyState>No schedules in scope.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-background-elevated text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Phase</th>
                  <th className="px-3 py-2">Creative</th>
                  <th className="px-3 py-2">Screen</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Window</th>
                  <th className="px-3 py-2">Advertiser</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.rows.slice(0, 100).map((r) => (
                  <tr key={r.scheduleId} className="hover:bg-background-elevated">
                    <td className="px-3 py-2">
                      <WindowPhaseBadge phase={r.phase} />
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {r.creativeName}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {r.hostName} · {r.screenName}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{r.kind}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {r.windowStart || "—"} → {r.windowEnd || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-strong">
                      {r.advertiserEmail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Played (F2) — first-party plays</SectionTitle>
        <p className="text-xs text-muted">
          <span className="font-medium text-foreground">Played (F2)</span> —
          device <code className="text-muted-strong">PlayLog</code> soak counts
          for this range (adjacent to Scheduled fill / heat above). OptiSigns CSV
          + Looker remain production PoP until cutover.
        </p>
        <StatRow className="lg:grid-cols-4">
          <StatPill label="Plays" value={String(playsSummary.playCount)} />
          <StatPill
            label="Duration"
            value={fmtDurMs(playsSummary.totalDurationMs)}
          />
          <StatPill
            label="Screens"
            value={String(playsSummary.screenCount)}
          />
          <StatPill
            label="Creatives"
            value={String(playsSummary.creativeCount)}
          />
        </StatRow>
        {playRows.length === 0 ? (
          <EmptyState>
            <p className="font-medium text-foreground">No Played (F2) rows yet</p>
            <p>
              Zero first-party <code className="text-muted-strong">PlayLog</code>{" "}
              events in this range. Scheduled fill / heat above still reflect
              open hours + ACTIVE schedules — Plays stay empty until devices
              report (never stubbed).
            </p>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-background-elevated text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Screen</th>
                  <th className="px-3 py-2">Creative</th>
                  <th className="px-3 py-2">Advertiser</th>
                  <th className="px-3 py-2 text-right">Plays</th>
                  <th className="px-3 py-2 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {playRows.slice(0, 100).map((r) => (
                  <tr
                    key={`${r.screenId}-${r.creativeId}`}
                    className="hover:bg-background-elevated"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">
                        {r.screenName}
                      </div>
                      <div className="text-xs text-muted">{r.hostName}</div>
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {r.creativeName}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {r.advertiserEmail}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {r.playCount}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">
                      {fmtDurMs(r.totalDurationMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
