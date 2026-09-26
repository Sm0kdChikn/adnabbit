"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type Option = { id: string; label: string };

export function AnalyticsFilters({
  basePath,
  exportBase,
  hosts = [],
  screens = [],
  advertisers = [],
  showHostFilter = false,
  showScreenFilter = true,
  showAdvertiserFilter = false,
}: {
  basePath: string;
  exportBase: string;
  hosts?: Option[];
  screens?: Option[];
  advertisers?: Option[];
  showHostFilter?: boolean;
  showScreenFilter?: boolean;
  showAdvertiserFilter?: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [range, setRange] = useState(sp.get("range") || "7");
  const [from, setFrom] = useState(sp.get("from") || "");
  const [to, setTo] = useState(sp.get("to") || "");
  const [hostId, setHostId] = useState(sp.get("hostId") || "");
  const [screenId, setScreenId] = useState(sp.get("screenId") || "");
  const [advertiserId, setAdvertiserId] = useState(sp.get("advertiserId") || "");

  function buildParams(overrides?: Record<string, string>) {
    const params = new URLSearchParams();
    const r = overrides?.range ?? range;
    const f = overrides?.from ?? from;
    const t = overrides?.to ?? to;
    if (r === "custom") {
      if (f.trim()) params.set("from", f.trim());
      if (t.trim()) params.set("to", t.trim());
      params.set("range", "custom");
    } else if (r === "30") {
      params.set("range", "30");
    } else {
      params.set("range", "7");
    }
    const h = overrides?.hostId ?? hostId;
    const s = overrides?.screenId ?? screenId;
    const a = overrides?.advertiserId ?? advertiserId;
    if (h.trim()) params.set("hostId", h.trim());
    if (s.trim()) params.set("screenId", s.trim());
    if (a.trim()) params.set("advertiserId", a.trim());
    return params;
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const q = buildParams().toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  function clear() {
    setRange("7");
    setFrom("");
    setTo("");
    setHostId("");
    setScreenId("");
    setAdvertiserId("");
    router.push(`${basePath}?range=7`);
  }

  const exportQs = useMemo(() => {
    const params = new URLSearchParams();
    for (const key of [
      "range",
      "from",
      "to",
      "hostId",
      "screenId",
      "advertiserId",
    ] as const) {
      const v = sp.get(key);
      if (v) params.set(key, v);
    }
    return params;
  }, [sp]);

  function exportHref(table: string) {
    const p = new URLSearchParams(exportQs);
    p.set("table", table);
    const qs = p.toString();
    return `${exportBase}${qs ? `?${qs}` : `?table=${table}`}`;
  }

  return (
    <form
      onSubmit={apply}
      className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Date range
          </label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {range === "custom" ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </div>
          </>
        ) : null}
        {showHostFilter ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Host
            </label>
            <select
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              className="max-w-[14rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">All hosts</option>
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {showScreenFilter ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Screen
            </label>
            <select
              value={screenId}
              onChange={(e) => setScreenId(e.target.value)}
              className="max-w-[14rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">All screens</option>
              {screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {showAdvertiserFilter ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Advertiser
            </label>
            <select
              value={advertiserId}
              onChange={(e) => setAdvertiserId(e.target.value)}
              className="max-w-[14rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="">All advertisers</option>
              {advertisers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:brightness-110"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-md bg-surface-hover px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          Reset
        </button>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <span className="self-center text-xs uppercase tracking-wide text-muted-strong">
          Export CSV
        </span>
        <a
          href={exportHref("fill")}
          className="rounded-md border border-accent/40 bg-accent-dim px-3 py-1.5 text-sm font-medium text-accent hover:border-accent/70"
        >
          Fill
        </a>
        <a
          href={exportHref("daypart")}
          className="rounded-md border border-accent/40 bg-accent-dim px-3 py-1.5 text-sm font-medium text-accent hover:border-accent/70"
        >
          Daypart heat
        </a>
        <a
          href={exportHref("campaigns")}
          className="rounded-md border border-accent/40 bg-accent-dim px-3 py-1.5 text-sm font-medium text-accent hover:border-accent/70"
        >
          Campaigns
        </a>
      </div>
    </form>
  );
}
