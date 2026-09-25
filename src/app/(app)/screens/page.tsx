import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import { InventoryBadge } from "@/components/StatusBadge";
import { BrowseFilters } from "./BrowseFilters";
import { RequestPlacementButton } from "./RequestPlacementButton";
import {
  formatVertical,
  isHostVertical,
} from "@/lib/types";
import type { Prisma } from "@prisma/client";

export default async function ScreensBrowsePage({
  searchParams,
}: {
  searchParams: {
    city?: string;
    zip?: string;
    vertical?: string;
    q?: string;
    includeFull?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/screens");
  if (session.user.role === "HOST") redirect("/host");


  const city = searchParams.city?.trim() || "";
  const zip = searchParams.zip?.trim() || "";
  const vertical = searchParams.vertical?.trim() || "";
  const q = searchParams.q?.trim() || "";
  const includeFull = searchParams.includeFull === "1";

  const where: Prisma.ScreenWhereInput = {};
  if (!includeFull) {
    where.inventoryStatus = { in: ["OPEN", "LIMITED"] };
  }
  if (city) where.city = { contains: city };
  if (zip) where.zip = { contains: zip };
  if (vertical && isHostVertical(vertical)) {
    where.host = { vertical };
  }
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { notes: { contains: q } },
      { host: { name: { contains: q } } },
    ];
  }

  const screens = await prisma.screen.findMany({
    where,
    orderBy: [{ city: "asc" }, { name: "asc" }],
    include: {
      host: { select: { id: true, name: true, vertical: true, otherLabel: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Browse screens</h1>
          <p className="text-sm text-muted">
            Request placement on OPEN or LIMITED inventory. Attach an APPROVED creative.
          </p>
        </div>
        <Link
          href="/placements"
          className="rounded-md bg-accent-dim px-4 py-2 text-sm font-medium text-accent hover:bg-accent/15"
        >
          My placement requests
        </Link>
      </div>

      <Suspense fallback={null}>
        <BrowseFilters />
      </Suspense>

      {screens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          No screens match your filters.
        </p>
      ) : (
        <ul className="space-y-3">
          {screens.map((s) => {
            const requestable =
              s.inventoryStatus === "OPEN" || s.inventoryStatus === "LIMITED";
            return (
              <li
                key={s.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-foreground">{s.name}</h2>
                      <InventoryBadge status={s.inventoryStatus} />
                    </div>
                    <p className="text-sm text-muted">
                      {s.host.name} ·{" "}
                      {formatVertical(s.host.vertical, s.host.otherLabel)} · {s.city}{" "}
                      {s.zip}
                    </p>
                    {s.notes && <p className="text-sm text-muted">{s.notes}</p>}
                  </div>
                  <RequestPlacementButton screenId={s.id} disabled={!requestable} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
