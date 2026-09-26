import { Suspense } from "react";
import {
  type CampaignRollup,
  type DaypartHeatResult,
  type DateRange,
  type FillRow,
  type FillSummary,
  WEEKDAY_LABELS,
} from "@/lib/analytics";
import { WindowPhaseBadge } from "@/components/StatusBadge";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  SectionTitle,
  StatPill,
  StatRow,
} from "@/components/ui";
import { AnalyticsFilters } from "./AnalyticsFilters";

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
        . Metrics from open hours + ACTIVE schedules — not device plays.
      </p>

      <section className="space-y-3">
        <SectionTitle>Schedule fill</SectionTitle>
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
          <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
            No screen/day rows in range.
          </p>
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
                        <span className="ml-2 rounded bg-[var(--status-danger-bg)] px-1.5 py-0.5 text-[10px] text-[var(--status-danger-fg)]">
                          take-down
                        </span>
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
        <SectionTitle>Daypart heat</SectionTitle>
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
        <SectionTitle>Campaign windows</SectionTitle>
        <StatRow className="lg:grid-cols-5">
          <StatPill label="Active" value={campaigns.counts.ACTIVE || 0} />
          <StatPill label="Scheduled" value={campaigns.counts.SCHEDULED || 0} />
          <StatPill label="Expired" value={campaigns.counts.EXPIRED || 0} />
          <StatPill label="Draft" value={campaigns.counts.DRAFT || 0} />
          <StatPill label="Cancelled" value={campaigns.counts.CANCELLED || 0} />
        </StatRow>
        {campaigns.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
            No schedules in scope.
          </p>
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

      <Card className="border-dashed border-border/80">
        <CardHeader>
          <h3 className="text-sm font-semibold text-foreground">Plays</h3>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-muted">
            <span className="font-medium text-accent">Awaits F2</span> — device{" "}
            <code className="text-xs text-muted-strong">/api/device/play-logs</code>{" "}
            remains a 202 stub (no persistence). OptiSigns CSV import + Looker
            stay production proof-of-play. This dashboard does{" "}
            <strong className="text-foreground">not</strong> invent play counts
            from schedules.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
