import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PlacementBadge } from "@/components/StatusBadge";
import { formatVertical } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function PlacementsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/placements");
  if (session.user.role === "HOST") redirect("/host");


  const placements = await prisma.placementRequest.findMany({
    where: { advertiserId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      screen: {
        include: {
          host: { select: { name: true, vertical: true, otherLabel: true } },
        },
      },
      creative: { select: { id: true, name: true, storedName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement requests"
        description="Track status. Rejected requests show the admin reason."
        actions={
          <Link
            href="/screens"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent shadow-glow-sm hover:brightness-110"
          >
            Browse screens
          </Link>
        }
      />

      {placements.length === 0 ? (
        <EmptyState>
          No placement requests yet.{" "}
          <Link href="/screens" className="text-accent hover:underline">
            Browse screens
          </Link>
          .
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {placements.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-foreground">
                      {p.screen.name} · {p.creative.name}
                    </h2>
                    <PlacementBadge status={p.status} />
                  </div>
                  <p className="text-sm text-muted">
                    {p.screen.host.name} ·{" "}
                    {formatVertical(p.screen.host.vertical, p.screen.host.otherLabel)} ·{" "}
                    {p.screen.city} {p.screen.zip}
                  </p>
                  {p.note && (
                    <p className="text-sm text-muted">
                      <span className="font-medium">Your note:</span> {p.note}
                    </p>
                  )}
                  {p.status === "REJECTED" && p.rejectReason && (
                    <p className="rounded-md bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-fg)]">
                      <span className="font-medium">Rejection reason:</span> {p.rejectReason}
                    </p>
                  )}
                  <p className="text-xs text-muted-strong">
                    Requested {new Date(p.createdAt).toLocaleString()}
                    {p.reviewedAt &&
                      ` · Reviewed ${new Date(p.reviewedAt).toLocaleString()}`}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
