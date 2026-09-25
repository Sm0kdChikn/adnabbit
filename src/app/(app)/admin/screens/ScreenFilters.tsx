"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  HOST_VERTICALS,
  HOST_VERTICAL_LABELS,
  INVENTORY_STATUSES,
} from "@/lib/types";

export function ScreenFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [city, setCity] = useState(sp.get("city") || "");
  const [zip, setZip] = useState(sp.get("zip") || "");
  const [inventoryStatus, setInventoryStatus] = useState(sp.get("inventoryStatus") || "");
  const [vertical, setVertical] = useState(sp.get("vertical") || "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (zip.trim()) params.set("zip", zip.trim());
    if (inventoryStatus) params.set("inventoryStatus", inventoryStatus);
    if (vertical) params.set("vertical", vertical);
    const q = params.toString();
    router.push(q ? `/admin/screens?${q}` : "/admin/screens");
  }

  function clear() {
    setCity("");
    setZip("");
    setInventoryStatus("");
    setVertical("");
    router.push("/admin/screens");
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
        <label className="mb-1 block text-xs font-medium text-muted">Inventory</label>
        <select
          value={inventoryStatus}
          onChange={(e) => setInventoryStatus(e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          <option value="">Any</option>
          {INVENTORY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Host vertical
        </label>
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
      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-brand-bg hover:brightness-110"
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
