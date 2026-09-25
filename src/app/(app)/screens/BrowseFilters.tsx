"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { HOST_VERTICALS, HOST_VERTICAL_LABELS } from "@/lib/types";

export function BrowseFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [city, setCity] = useState(sp.get("city") || "");
  const [zip, setZip] = useState(sp.get("zip") || "");
  const [vertical, setVertical] = useState(sp.get("vertical") || "");
  const [q, setQ] = useState(sp.get("q") || "");
  const [includeFull, setIncludeFull] = useState(sp.get("includeFull") === "1");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (zip.trim()) params.set("zip", zip.trim());
    if (vertical) params.set("vertical", vertical);
    if (q.trim()) params.set("q", q.trim());
    if (includeFull) params.set("includeFull", "1");
    const qs = params.toString();
    router.push(qs ? `/screens?${qs}` : "/screens");
  }

  function clear() {
    setCity("");
    setZip("");
    setVertical("");
    setQ("");
    setIncludeFull(false);
    router.push("/screens");
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">City</label>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-36 rounded-md border border-border px-2 py-1.5 text-sm"
          placeholder="Denver"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">ZIP</label>
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          className="w-28 rounded-md border border-border px-2 py-1.5 text-sm"
          placeholder="80202"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Host vertical</label>
        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          <option value="">Any</option>
          {HOST_VERTICALS.map((v) => (
            <option key={v} value={v}>
              {HOST_VERTICAL_LABELS[v]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Venue / notes</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-44 rounded-md border border-border px-2 py-1.5 text-sm"
          placeholder="Search…"
        />
      </div>
      <label className="mb-1.5 flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={includeFull}
          onChange={(e) => setIncludeFull(e.target.checked)}
          className="rounded border-border"
        />
        Show FULL (unavailable)
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
    </form>
  );
}
