import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, EmptyState } from "@/components/ui";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your creatives</h1>
          <p className="text-sm text-muted">Upload, submit for review, and track status.</p>
        </div>
        <Link
          href="/creatives/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-brand-bg shadow-glow-sm hover:brightness-110"
        >
          Upload creative
        </Link>
      </div>

      {creatives.length === 0 ? (
        <EmptyState>
          No creatives yet.{" "}
          <Link href="/creatives/new" className="text-accent hover:underline">
            Upload your first
          </Link>
          .
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {creatives.map((c) => (
            <li key={c.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-foreground">{c.name}</h2>
                      <StatusBadge status={c.status} />
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
