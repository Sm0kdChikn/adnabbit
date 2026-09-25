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
import {
  Card,
  CardList,
  CardListItem,
  EmptyState,
  PageHeader,
  ViewToggle,
} from "@/components/ui";

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
      <PageHeader
        title="Screens"
        description="Filter by city, ZIP, inventory status, or host vertical."
        actions={
          <>
            <ViewToggle />
            <Link
              href="/admin/screens/new"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent shadow-glow-sm hover:brightness-110"
            >
              New screen
            </Link>
          </>
        }
      />

      <Suspense fallback={null}>
        <ScreenFilters />
      </Suspense>

      {screens.length === 0 ? (
        <EmptyState>
          No screens match.{" "}
          <Link href="/admin/screens/new" className="text-accent hover:underline">
            Create one
          </Link>
          .
        </EmptyState>
      ) : (
        <CardList>
          {screens.map((s) => (
            <CardListItem key={s.id}>
              <Card glow className="flex h-full flex-col p-4">
                <div className="flex flex-1 flex-col gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      href={`/admin/screens/${s.id}`}
                      className="font-semibold text-accent hover:underline"
                    >
                      {s.name}
                    </Link>
                    <p className="text-sm text-muted">
                      {s.city}, {s.zip} ·{" "}
                      <Link
                        href={`/admin/hosts/${s.host.id}`}
                        className="hover:text-accent"
                      >
                        {s.host.name}
                      </Link>{" "}
                      · {formatVertical(s.host.vertical, s.host.otherLabel)}
                    </p>
                    {s.notes && (
                      <p className="text-xs text-muted-strong">{s.notes}</p>
                    )}
                  </div>
                  <InventoryBadge status={s.inventoryStatus} />
                </div>
              </Card>
            </CardListItem>
          ))}
        </CardList>
      )}
    </div>
  );
}
