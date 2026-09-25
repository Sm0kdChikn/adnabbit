"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function PopFilters({ basePath }: { basePath: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [from, setFrom] = useState(sp.get("from") || "");
  const [to, setTo] = useState(sp.get("to") || "");
  const [screen, setScreen] = useState(sp.get("screen") || "");
  const [asset, setAsset] = useState(sp.get("asset") || "");
  const [screenTags, setScreenTags] = useState(sp.get("screenTags") || "");
  const [includeFiller, setIncludeFiller] = useState(sp.get("includeFiller") === "1");

  function buildParams() {
    const params = new URLSearchParams();
    if (from.trim()) params.set("from", from.trim());
    if (to.trim()) params.set("to", to.trim());
    if (screen.trim()) params.set("screen", screen.trim());
    if (asset.trim()) params.set("asset", asset.trim());
    if (screenTags.trim()) params.set("screenTags", screenTags.trim());
    if (includeFiller) params.set("includeFiller", "1");
    return params;
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const q = buildParams().toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  function clear() {
    setFrom("");
    setTo("");
    setScreen("");
    setAsset("");
    setScreenTags("");
    setIncludeFiller(false);
    router.push(basePath);
  }

  // Export matches currently applied (URL) filters so CSV matches the table
  const exportParams = new URLSearchParams();
  for (const key of ["from", "to", "screen", "asset", "screenTags", "includeFiller"] as const) {
    const v = sp.get(key);
    if (v) exportParams.set(key, v);
  }
  const exportQs = exportParams.toString();
  const exportHref =
    (basePath.startsWith("/admin") ? "/api/admin/pop/export" : "/api/pop/export") +
    (exportQs ? `?${exportQs}` : "");

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">From (UTC)</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">To (UTC)</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Screen name / UUID</label>
        <input
          value={screen}
          onChange={(e) => setScreen(e.target.value)}
          className="w-40 rounded-md border border-border px-2 py-1.5 text-sm"
          placeholder="Lobby"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Asset name / ID</label>
        <input
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
          className="w-40 rounded-md border border-border px-2 py-1.5 text-sm"
          placeholder="Banner"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Screen tags (geo-*, cat-*, …)
        </label>
        <input
          value={screenTags}
          onChange={(e) => setScreenTags(e.target.value)}
          className="w-36 rounded-md border border-border px-2 py-1.5 text-sm"
          placeholder="geo-denver"
        />
      </div>
      <label className="flex items-center gap-2 pb-1.5 text-sm text-muted">
        <input
          type="checkbox"
          checked={includeFiller}
          onChange={(e) => setIncludeFiller(e.target.checked)}
          className="rounded border-border"
        />
        Include host filler
      </label>
      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:brightness-110"
      >
        Filter
      </button>
      <button
        type="button"
        onClick={clear}
        className="rounded-md bg-surface-hover px-3 py-1.5 text-sm text-muted hover:bg-surface-hover"
      >
        Clear
      </button>
      <a
        href={exportHref}
        className="rounded-md bg-[var(--status-success-bg)] px-3 py-1.5 text-sm font-medium text-[var(--status-success-fg)] hover:brightness-95"
      >
        Export CSV
      </a>
    </form>
  );
}
