import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PlacementBadge } from "@/components/StatusBadge";
import { PlacementActions } from "./PlacementActions";
import { formatVertical } from "@/lib/types";
import {
  CardList,
  CardListItem,
  EmptyState,
  PageHeader,
  SectionTitle,
  ViewToggle,
} from "@/components/ui";

export default async function AdminPlacementsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const pending = await prisma.placementRequest.findMany({
    where: { status: "REQUESTED" },
    orderBy: { createdAt: "asc" },
    include: {
      advertiser: { select: { email: true, name: true } },
      screen: {
        include: {
          host: { select: { name: true, vertical: true, otherLabel: true } },
        },
      },
      creative: {
        select: { id: true, name: true, fileName: true, storedName: true },
      },
    },
  });

  const recent = await prisma.placementRequest.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    orderBy: { reviewedAt: "desc" },
    take: 20,
    include: {
      advertiser: { select: { email: true, name: true } },
      screen: {
        include: {
          host: { select: { name: true, vertical: true, otherLabel: true } },
        },
      },
      creative: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Placement queue"
        description="Approve or reject REQUESTED placements (reject requires a reason)."
        actions={
          <>
            <ViewToggle />
            <Link
              href="/admin"
              className="rounded-md bg-accent-dim px-3 py-1.5 text-sm text-accent hover:bg-accent/15"
            >
              Creatives
            </Link>
            <Link
              href="/admin/screens"
              className="rounded-md bg-accent-dim px-3 py-1.5 text-sm text-accent hover:bg-accent/15"
            >
              Screens
            </Link>
          </>
        }
      />

      <section className="space-y-3">
        <SectionTitle>Requested ({pending.length})</SectionTitle>
        {pending.length === 0 ? (
          <EmptyState>No pending placement requests.</EmptyState>
        ) : (
          <CardList>
            {pending.map((p) => (
              <CardListItem key={p.id}>
                <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">
                          {p.screen.name} ← {p.creative.name}
                        </h3>
                        <PlacementBadge status={p.status} />
                      </div>
                      <p className="text-sm text-muted">
                        By {p.advertiser.name || p.advertiser.email} · {p.screen.host.name} ·{" "}
                        {formatVertical(p.screen.host.vertical, p.screen.host.otherLabel)} ·{" "}
                        {p.screen.city} {p.screen.zip}
                      </p>
                      {p.note && (
                        <p className="text-sm text-muted">
                          <span className="font-medium">Note:</span> {p.note}
                        </p>
                      )}
                      <a
                        href={`/api/uploads/${p.creative.storedName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-sm text-accent hover:underline"
                      >
                        Preview creative
                      </a>
                    </div>
                    <PlacementActions placementId={p.id} />
                  </div>
                </div>
              </CardListItem>
            ))}
          </CardList>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Recent decisions</SectionTitle>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">No decisions yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {recent.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <span className="font-medium text-foreground">
                    {p.screen.name} ← {p.creative.name}
                  </span>
                  <span className="ml-2 text-sm text-muted">{p.advertiser.email}</span>
                  {p.status === "REJECTED" && p.rejectReason && (
                    <p className="text-xs text-[var(--status-danger-fg)]">{p.rejectReason}</p>
                  )}
                </div>
                <PlacementBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
