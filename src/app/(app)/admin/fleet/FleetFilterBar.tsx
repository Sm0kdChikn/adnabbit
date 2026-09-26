"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "offline", label: "Offline" },
  { id: "empty", label: "Empty" },
  { id: "version", label: "Version" },
  { id: "attention", label: "Attention" },
] as const;

export function FleetFilterBar({
  filter,
  counts,
}: {
  filter: string;
  counts: Record<string, number>;
}) {
  const sp = useSearchParams();
  void sp;

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const active = filter === f.id;
        const n = counts[f.id] ?? 0;
        return (
          <Link
            key={f.id}
            href={f.id === "all" ? "/admin/fleet" : `/admin/fleet?filter=${f.id}`}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              active
                ? "bg-accent text-on-accent shadow-glow-sm"
                : "border border-border bg-surface text-muted hover:border-accent/40 hover:text-accent"
            }`}
          >
            {f.label}
            <span className={`ml-1.5 tabular-nums ${active ? "opacity-90" : "opacity-70"}`}>
              {n}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
