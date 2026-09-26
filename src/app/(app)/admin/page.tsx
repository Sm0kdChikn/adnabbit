import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
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
import { ReviewActions } from "./ReviewActions";
import { TakeDownPanel } from "@/components/TakeDownPanel";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [pending, recent, pendingPlacements, screenCount] = await Promise.all([
    prisma.creative.findMany({
      where: { status: "PENDING" },
      orderBy: { updatedAt: "asc" },
      include: { advertiser: { select: { email: true, name: true } } },
    }),
    prisma.creative.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 20,
      include: { advertiser: { select: { email: true, name: true } } },
    }),
    prisma.placementRequest.count({ where: { status: "REQUESTED" } }),
    prisma.screen.count(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin review queue"
        description="Approve or reject PENDING creatives."
        actions={<ViewToggle />}
      />

      <StatRow>
        <StatPill label="Pending creatives" value={pending.length} />
        <StatPill label="Pending placements" value={pendingPlacements} />
        <StatPill label="Screens" value={screenCount} />
      </StatRow>

      <section className="space-y-3">
        <SectionTitle>Pending ({pending.length})</SectionTitle>
        {pending.length === 0 ? (
          <EmptyState>No pending creatives.</EmptyState>
        ) : (
          <CardList>
            {pending.map((c) => (
              <CardListItem key={c.id}>
                <Card glow className="flex h-full flex-col p-4">
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{c.name}</h3>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-sm text-muted">
                        By {c.advertiser.name || c.advertiser.email} · {c.fileName} ·{" "}
                        {(c.fileSize / 1024).toFixed(1)} KB
                      </p>
                      {c.notes && <p className="text-sm text-muted">{c.notes}</p>}
                      <a
                        href={`/api/uploads/${c.storedName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-sm text-accent hover:underline"
                      >
                        Preview file
                      </a>
                    </div>
                    <ReviewActions creativeId={c.id} />
                  </div>
                </Card>
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
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {recent.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-sm text-muted">{c.advertiser.email}</p>
                    {c.status === "REJECTED" && c.rejectReason && (
                      <p className="text-xs text-[var(--status-danger-fg)]">{c.rejectReason}</p>
                    )}
                  </div>
                  {c.status === "APPROVED" && (
                    <div className="w-full max-w-xs shrink-0">
                      <TakeDownPanel
                        target="creative"
                        id={c.id}
                        takenDownAt={c.takenDownAt}
                        reason={c.takenDownReason}
                        compact
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
