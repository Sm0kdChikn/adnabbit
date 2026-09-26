"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Admin nav badge: open fleet alert count. */
export function FleetAlertNavBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/alerts?count=1");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCount(typeof data.openCount === "number" ? data.openCount : 0);
      } catch {
        /* ignore */
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pathname]);

  if (!count || count <= 0) return null;

  return (
    <Link
      href="/admin/alerts"
      className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--status-danger-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--status-danger-fg)]"
      title={`${count} open fleet alert${count === 1 ? "" : "s"}`}
    >
      {count > 99 ? "99+" : count}
    </Link>
  );
}
