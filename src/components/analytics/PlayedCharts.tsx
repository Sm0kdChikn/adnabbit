"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AnalyticsRole,
  PlayedChartsResult,
} from "@/lib/analytics";
import { EmptyState, SectionTitle } from "@/components/ui";

const ACCENT = "#00e5ff";
const ACCENT_FILL = "rgba(0, 229, 255, 0.35)";
const GRID = "rgba(148, 163, 184, 0.18)";
const TICK = "#94a3b8";
const BAR_DIM = "rgba(0, 229, 255, 0.55)";

function ChartCard({
  title,
  hint,
  children,
  actions,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; payload?: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const plays = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-md border border-border bg-background-elevated px-2.5 py-1.5 text-xs shadow-card">
      <div className="font-medium text-foreground">{label}</div>
      <div className="text-accent">
        {plays.toLocaleString()} {plays === 1 ? "play" : "plays"}
      </div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            value === o.id
              ? "rounded px-2.5 py-1 font-medium text-on-accent bg-accent"
              : "rounded px-2.5 py-1 text-muted hover:text-foreground"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PlayedCharts({
  charts,
  role,
  totalPlays,
}: {
  charts: PlayedChartsResult;
  role: AnalyticsRole;
  totalPlays: number;
}) {
  const [grain, setGrain] = useState<"day" | "hour">(
    charts.allowHourToggle && charts.byDay.length <= 2 ? "hour" : "day"
  );

  const timeSeries = useMemo(() => {
    if (grain === "hour" && charts.allowHourToggle) return charts.byHour;
    return charts.byDay;
  }, [charts, grain]);

  const timeHasData = timeSeries.some((p) => p.playCount > 0);
  const daypartHasData = charts.daypart.some((p) => p.playCount > 0);

  const showCreative = role === "ADVERTISER" || role === "ADMIN";
  const showScreen = role === "HOST" || role === "ADMIN";
  const showAdvertiser = role === "ADMIN";

  const creativeData = charts.byCreative;
  const screenData = charts.byScreen;
  const advertiserData = charts.byAdvertiser;

  if (totalPlays <= 0) {
    return (
      <section className="space-y-3">
        <SectionTitle>Played (F2) — proof of play charts</SectionTitle>
        <EmptyState>
          <p className="font-medium text-foreground">No Played data yet</p>
          <p>
            Charts stay empty until devices report{" "}
            <code className="text-muted-strong">PlayLog</code> events. Scheduled
            fill / heat above are Ticket T scheduled minutes — not plays.
          </p>
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <SectionTitle>Played (F2) — proof of play charts</SectionTitle>
        <p className="mt-1 text-xs text-muted">
          <span className="font-medium text-foreground">Played</span> = first-party{" "}
          <code className="text-muted-strong">PlayLog</code> only (not OptiSigns
          PlayEvent). TZ{" "}
          <span className="text-foreground">{charts.timezone}</span>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Played over time"
          hint={
            grain === "hour"
              ? "Play counts by hour"
              : "Play counts by day"
          }
          actions={
            charts.allowHourToggle ? (
              <Toggle
                value={grain}
                onChange={(v) => setGrain(v as "day" | "hour")}
                options={[
                  { id: "day", label: "Day" },
                  { id: "hour", label: "Hour" },
                ]}
              />
            ) : null
          }
        >
          {!timeHasData ? (
            <p className="py-10 text-center text-sm text-muted">
              No plays in this grain for the selected range.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timeSeries}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="playedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: TICK, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: TICK, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="playCount"
                    name="Plays"
                    stroke={ACCENT}
                    fill="url(#playedFill)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: ACCENT }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Daypart — plays by hour of day"
          hint="PlayLog counts aggregated by hour (not scheduled minutes)"
        >
          {!daypartHasData ? (
            <p className="py-10 text-center text-sm text-muted">
              No PlayLog daypart data in range.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={charts.daypart}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: TICK, fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                    tickFormatter={(h) => String(h)}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: TICK, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    labelFormatter={(_, payload) => {
                      const hour = payload?.[0]?.payload?.hour;
                      return typeof hour === "number"
                        ? `${String(hour).padStart(2, "0")}:00`
                        : "";
                    }}
                  />
                  <Bar dataKey="playCount" name="Plays" radius={[3, 3, 0, 0]}>
                    {charts.daypart.map((d) => (
                      <Cell
                        key={d.hour}
                        fill={d.playCount > 0 ? ACCENT_FILL : "transparent"}
                        stroke={d.playCount > 0 ? ACCENT : "transparent"}
                        strokeWidth={1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div
        className={`grid gap-4 ${
          showCreative && showScreen ? "lg:grid-cols-2" : "lg:grid-cols-1"
        }`}
      >
        {showCreative ? (
          <ChartCard
            title="Top creatives"
            hint="Breakdown by ad / creative (Played)"
          >
            {creativeData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No creative plays.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={creativeData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fill: TICK, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                      tick={{ fill: TICK, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="playCount"
                      name="Plays"
                      fill={BAR_DIM}
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ) : null}

        {showScreen ? (
          <ChartCard
            title="Top screens"
            hint="Breakdown by screen / venue (Played)"
          >
            {screenData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No screen plays.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={screenData}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fill: TICK, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                      tick={{ fill: TICK, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="playCount"
                      name="Plays"
                      fill={BAR_DIM}
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ) : null}
      </div>

      {showAdvertiser && advertiserData.length > 0 ? (
        <ChartCard
          title="Top advertisers"
          hint="Platform-wide Played breakdown (admin)"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={advertiserData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: TICK, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tick={{ fill: TICK, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="playCount"
                  name="Plays"
                  fill={BAR_DIM}
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : null}
    </section>
  );
}
