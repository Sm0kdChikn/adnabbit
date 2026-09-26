import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { TakeDownBadge } from "@/components/TakeDownPanel";
import {
  Card,
  CardList,
  CardListItem,
  EmptyState,
  PageHeader,
  StatPill,
  StatRow,
  ViewToggle,
} from "@/components/ui";
import { SubmitButton } from "./SubmitButton";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.role === "HOST") redirect("/host");

  const creatives = await prisma.creative.findMany({
    where: { advertiserId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const pending = creatives.filter((c) => c.status === "PENDING").length;
  const approved = creatives.filter((c) => c.status === "APPROVED").length;
  const drafts = creatives.filter(
    (c) => c.status === "DRAFT" || c.status === "REJECTED"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your creatives"
        description="Upload, submit for review, and track status."
        actions={
          <>
            <ViewToggle />
            <Link
              href="/creatives/new"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-glow-sm hover:brightness-110"
            >
              Upload creative
            </Link>
          </>
        }
      />

      {creatives.length > 0 ? (
        <StatRow>
          <StatPill label="Total creatives" value={creatives.length} />
          <StatPill label="Pending review" value={pending} />
          <StatPill label="Approved" value={approved} />
          {drafts > 0 ? (
            <StatPill
              label="Draft / rejected"
              value={drafts}
              className="sm:col-span-2 lg:col-span-1"
            />
          ) : null}
        </StatRow>
      ) : null}

      {creatives.length === 0 ? (
        <EmptyState>
          No creatives yet.{" "}
          <Link href="/creatives/new" className="text-accent hover:underline">
            Upload your first
          </Link>
          .
        </EmptyState>
      ) : (
        <CardList>
          {creatives.map((c) => (
            <CardListItem key={c.id}>
              <Card glow className="flex h-full flex-col p-4">
                <div className="flex flex-1 flex-col gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-foreground">{c.name}</h2>
                      <StatusBadge status={c.status} />
                      <TakeDownBadge
                        takenDownAt={c.takenDownAt}
                        reason={c.takenDownReason}
                      />
                    </div>
                    <p className="text-sm text-muted">
                      {c.fileName} · {(c.fileSize / 1024).toFixed(1)} KB · {c.mimeType}
                    </p>
                    {c.notes && <p className="text-sm text-muted">{c.notes}</p>}
                    {c.status === "REJECTED" && c.rejectReason && (
                      <p className="rounded-md bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-fg)]">
                        <span className="font-medium">Rejection reason:</span> {c.rejectReason}
                      </p>
                    )}
                    <a
                      href={`/api/uploads/${c.storedName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm text-accent hover:underline"
                    >
                      View file
                    </a>
                  </div>
                  {(c.status === "DRAFT" || c.status === "REJECTED") && (
                    <SubmitButton creativeId={c.id} />
                  )}
                </div>
              </Card>
            </CardListItem>
          ))}
        </CardList>
      )}
    </div>
  );
}
