import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import { InventoryBadge } from "@/components/StatusBadge";
import { ScreenFilters } from "./ScreenFilters";
import {
  formatVertical,
  isHostVertical,
  isInventoryStatus,
} from "@/lib/types";
import type { Prisma } from "@prisma/client";

export default async function AdminScreensPage({
  searchParams,
}: {
  searchParams: {
    city?: string;
    zip?: string;
    inventoryStatus?: string;
    vertical?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const city = searchParams.city?.trim() || "";
  const zip = searchParams.zip?.trim() || "";
  const inventoryStatus = searchParams.inventoryStatus?.trim() || "";
  const vertical = searchParams.vertical?.trim() || "";

  const where: Prisma.ScreenWhereInput = {};
  if (city) where.city = { contains: city };
  if (zip) where.zip = { contains: zip };
  if (inventoryStatus && isInventoryStatus(inventoryStatus)) {
    where.inventoryStatus = inventoryStatus;
  }
  if (vertical && isHostVertical(vertical)) {
    where.host = { vertical };
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
          <h1 className="text-2xl font-bold text-slate-900">Screens</h1>
          <p className="text-sm text-slate-600">
            Filter by city, ZIP, inventory status, or host vertical.
          </p>
        </div>
        <Link
          href="/admin/screens/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New screen
        </Link>
      </div>

      <Suspense fallback={null}>
        <ScreenFilters />
      </Suspense>

      {screens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No screens match.{" "}
          <Link href="/admin/screens/new" className="text-indigo-600 hover:underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {screens.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/screens/${s.id}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {s.name}
                </Link>
                <p className="text-sm text-slate-500">
                  {s.city}, {s.zip} ·{" "}
                  <Link
                    href={`/admin/hosts/${s.host.id}`}
                    className="hover:text-indigo-600"
                  >
                    {s.host.name}
                  </Link>{" "}
                  · {formatVertical(s.host.vertical, s.host.otherLabel)}
                </p>
                {s.notes && <p className="text-xs text-slate-400">{s.notes}</p>}
              </div>
              <InventoryBadge status={s.inventoryStatus} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
