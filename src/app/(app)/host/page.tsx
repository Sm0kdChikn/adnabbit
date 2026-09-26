import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { InventoryBadge } from "@/components/StatusBadge";
import { formatVertical } from "@/lib/types";
import { isDeviceRecentlySeen } from "@/lib/device";
import {
  Card,
  CardList,
  CardListItem,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatPill,
  StatRow,
  ViewToggle,
} from "@/components/ui";

export default async function HostPortalPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/hosts");
  if (session.user.role !== "HOST") redirect("/dashboard");

  const host = await prisma.host.findUnique({
    where: { userId: session.user.id },
    include: {
      screens: {
        orderBy: { name: "asc" },
        include: { device: { select: { lastSeenAt: true } } },
      },
    },
  });

  if (!host) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Host portal"
          description="Your venue workspace."
        />
        <p className="rounded-xl border border-amber-500/30 bg-[var(--status-warning-bg)] p-6 text-sm text-[var(--status-warning-fg)]">
          No venue is linked to this account yet. Ask an AdNabbit admin to attach your
          login to a host.
        </p>
      </div>
    );
  }

  const openScreens = host.screens.filter((s) => s.inventoryStatus === "OPEN").length;
  const limitedScreens = host.screens.filter(
    (s) => s.inventoryStatus === "LIMITED"
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={host.name}
        description={
          <>
            {formatVertical(host.vertical, host.otherLabel)} · {host.timezone}
            {host.notes ? (
              <span className="mt-1 block text-muted-strong">{host.notes}</span>
            ) : null}
          </>
        }
        actions={
          <>
            <ViewToggle />
            <Link
              href="/host/edit"
              className="rounded-md border border-border bg-accent-dim px-3 py-1.5 text-sm text-accent hover:border-accent/40"
            >
              Edit venue
            </Link>
            <Link
              href="/host/screens/new"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent shadow-glow-sm hover:brightness-110"
            >
              Add screen
            </Link>
          </>
        }
      />

      <StatRow>
        <StatPill label="Screens" value={host.screens.length} />
        <StatPill label="Open inventory" value={openScreens} />
        <StatPill label="Limited" value={limitedScreens} />
      </StatRow>

      <section className="space-y-3">
        <SectionTitle>Your screens ({host.screens.length})</SectionTitle>
        {host.screens.length === 0 ? (
          <EmptyState>
            No screens yet.{" "}
            <Link href="/host/screens/new" className="text-accent hover:underline">
              Add one
            </Link>
            .
          </EmptyState>
        ) : (
          <CardList>
            {host.screens.map((s) => (
              <CardListItem key={s.id}>
                <Card glow className="flex h-full flex-col p-4">
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        href={`/host/screens/${s.id}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        {s.name}
                      </Link>
                      <p className="text-sm text-muted">
                        {s.city}, {s.zip}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <InventoryBadge status={s.inventoryStatus} />
                        {s.device ? (
                          isDeviceRecentlySeen(s.device.lastSeenAt) ? (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                              Online
                            </span>
                          ) : (
                            <span className="rounded-full bg-[var(--status-danger-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-danger-fg)]">
                              Offline
                            </span>
                          )
                        ) : (
                          <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs font-semibold text-slate-300">
                            Unpaired
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/host/screens/${s.id}`}
                        className="text-sm text-muted hover:text-accent"
                      >
                        Manage
                      </Link>
                    </div>
                    {s.device?.lastSeenAt ? (
                      <p className="text-xs text-muted-strong">
                        Last seen {s.device.lastSeenAt.toLocaleString()}
                      </p>
                    ) : s.device ? (
                      <p className="text-xs text-muted-strong">Last seen: never</p>
                    ) : null}
                  </div>
                </Card>
              </CardListItem>
            ))}
          </CardList>
        )}
      </section>

      <p className="text-xs text-muted-strong">
        Placement approve/reject and scheduling stay with AdNabbit admins. You can view
        placements and schedules on each screen (read-only).
      </p>
    </div>
  );
}
