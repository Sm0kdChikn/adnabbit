import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, EmptyState } from "@/components/ui";
import { ReviewActions } from "./ReviewActions";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const pending = await prisma.creative.findMany({
    where: { status: "PENDING" },
    orderBy: { updatedAt: "asc" },
    include: { advertiser: { select: { email: true, name: true } } },
  });

  const recent = await prisma.creative.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    orderBy: { reviewedAt: "desc" },
    take: 20,
    include: { advertiser: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin review queue</h1>
        <p className="text-sm text-muted">Approve or reject PENDING creatives.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <EmptyState>No pending creatives.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {pending.map((c) => (
              <li key={c.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recent decisions</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">No decisions yet.</p>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {recent.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="ml-2 text-sm text-muted">{c.advertiser.email}</span>
                    {c.status === "REJECTED" && c.rejectReason && (
                      <p className="text-xs text-[var(--status-danger-fg)]">{c.rejectReason}</p>
                    )}
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
