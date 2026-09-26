"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_TARGET_TYPE_OPTIONS,
} from "@/lib/audit-constants";

export function AuditFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [action, setAction] = useState(sp.get("action") || "");
  const [actor, setActor] = useState(sp.get("actor") || "");
  const [targetType, setTargetType] = useState(sp.get("targetType") || "");
  const [targetId, setTargetId] = useState(sp.get("targetId") || "");
  const [from, setFrom] = useState(sp.get("from") || "");
  const [to, setTo] = useState(sp.get("to") || "");

  function buildParams() {
    const params = new URLSearchParams();
    if (action.trim()) params.set("action", action.trim());
    if (actor.trim()) params.set("actor", actor.trim());
    if (targetType.trim()) params.set("targetType", targetType.trim());
    if (targetId.trim()) params.set("targetId", targetId.trim());
    if (from.trim()) params.set("from", from.trim());
    if (to.trim()) params.set("to", to.trim());
    return params;
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const q = buildParams().toString();
    router.push(q ? `/admin/audit?${q}` : "/admin/audit");
  }

  function clear() {
    setAction("");
    setActor("");
    setTargetType("");
    setTargetId("");
    setFrom("");
    setTo("");
    router.push("/admin/audit");
  }

  const inputCls =
    "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground";

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="min-w-[10rem]">
        <label className="mb-1 block text-xs font-medium text-muted">Action</label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className={inputCls}
        >
          <option value="">All</option>
          {AUDIT_ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[12rem]">
        <label className="mb-1 block text-xs font-medium text-muted">
          Actor (user id)
        </label>
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="cuid…"
          className={inputCls}
        />
      </div>
      <div className="min-w-[9rem]">
        <label className="mb-1 block text-xs font-medium text-muted">
          Target type
        </label>
        <select
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          className={inputCls}
        >
          <option value="">All</option>
          {AUDIT_TARGET_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[12rem]">
        <label className="mb-1 block text-xs font-medium text-muted">
          Target id
        </label>
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="id…"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={inputCls}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:opacity-90"
        >
          Filter
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
