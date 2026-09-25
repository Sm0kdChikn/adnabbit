"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SCHEDULE_STATUSES } from "@/lib/types";

type ScreenOpt = { id: string; name: string; hostName: string };

export function ScheduleFilters({ screens }: { screens: ScreenOpt[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [screenId, setScreenId] = useState(sp.get("screenId") || "");
  const [status, setStatus] = useState(sp.get("status") || "");
  const [from, setFrom] = useState(sp.get("from") || "");
  const [to, setTo] = useState(sp.get("to") || "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (screenId) params.set("screenId", screenId);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const q = params.toString();
    router.push(q ? `/admin/schedules?${q}` : "/admin/schedules");
  }

  function clear() {
    setScreenId("");
    setStatus("");
    setFrom("");
    setTo("");
    router.push("/admin/schedules");
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Screen</label>
        <select
          value={screenId}
          onChange={(e) => setScreenId(e.target.value)}
          className="max-w-xs rounded-md border border-border px-2 py-1.5 text-sm"
        >
          <option value="">Any</option>
          {screens.map((s) => (
            <option key={s.id} value={s.id}>
              {s.hostName} · {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        >
          <option value="">Any</option>
          {SCHEDULE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">From</label>
        <input
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">To</label>
        <input
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm"
        />
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
