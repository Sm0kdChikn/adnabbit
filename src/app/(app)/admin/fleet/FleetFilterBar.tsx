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

export type FleetGroupOption = {
  id: string;
  name: string;
  memberCount: number;
};

export function FleetFilterBar({
  filter,
  counts,
  groups,
  groupId,
}: {
  filter: string;
  counts: Record<string, number>;
  groups: FleetGroupOption[];
  groupId: string | null;
}) {
  const sp = useSearchParams();
  void sp;

  function hrefFor(f: string, g: string | null) {
    const params = new URLSearchParams();
    if (f && f !== "all") params.set("filter", f);
    if (g) params.set("groupId", g);
    const q = params.toString();
    return q ? `/admin/fleet?${q}` : "/admin/fleet";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const n = counts[f.id] ?? 0;
          return (
            <Link
              key={f.id}
              href={hrefFor(f.id, groupId)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                active
                  ? "bg-accent text-on-accent shadow-glow-sm"
                  : "border border-border bg-surface text-muted hover:border-accent/40 hover:text-accent"
              }`}
            >
              {f.label}
              <span
                className={`ml-1.5 tabular-nums ${active ? "opacity-90" : "opacity-70"}`}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </div>

      {groups.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Group
          </span>
          <Link
            href={hrefFor(filter, null)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              !groupId
                ? "bg-accent text-on-accent shadow-glow-sm"
                : "border border-border bg-surface text-muted hover:border-accent/40 hover:text-accent"
            }`}
          >
            Any
          </Link>
          {groups.map((g) => {
            const active = groupId === g.id;
            return (
              <Link
                key={g.id}
                href={hrefFor(filter, g.id)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  active
                    ? "bg-accent text-on-accent shadow-glow-sm"
                    : "border border-border bg-surface text-muted hover:border-accent/40 hover:text-accent"
                }`}
                title={`${g.memberCount} member${g.memberCount === 1 ? "" : "s"}`}
              >
                {g.name}
                <span
                  className={`ml-1.5 tabular-nums ${active ? "opacity-90" : "opacity-70"}`}
                >
                  {g.memberCount}
                </span>
              </Link>
            );
          })}
          <Link
            href="/admin/groups"
            className="text-xs text-accent hover:underline"
          >
            Manage groups
          </Link>
        </div>
      ) : (
        <p className="text-xs text-muted">
          No device groups yet.{" "}
          <Link href="/admin/groups" className="text-accent hover:underline">
            Create one
          </Link>{" "}
          to filter fleet / bulk by group.
        </p>
      )}
    </div>
  );
}
