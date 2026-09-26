import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { listAuditEvents } from "@/lib/audit";
import { AUDIT_ACTION_OPTIONS } from "@/lib/audit-constants";
import { AuditFilters } from "./AuditFilters";

export const dynamic = "force-dynamic";

function actionLabel(action: string) {
  return AUDIT_ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: {
    action?: string;
    actor?: string;
    targetType?: string;
    targetId?: string;
    from?: string;
    to?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const { events, total, limit } = await listAuditEvents({
    action: searchParams.action,
    actorUserId: searchParams.actor,
    targetType: searchParams.targetType,
    targetId: searchParams.targetId,
    from: searchParams.from,
    to: searchParams.to,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Append-only admin actions (take-down, fleet bulk, force-live, hours, offline policy). Read-only — no edit/delete. Soft miss: CSV export, host/advertiser self-view."
      />

      <Suspense fallback={null}>
        <AuditFilters />
      </Suspense>

      <p className="text-sm text-muted">
        Showing {events.length} of {total} (limit {limit}), newest first.
      </p>

      {events.length === 0 ? (
        <EmptyState>No audit events match these filters.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Card glow className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent-dim px-2.5 py-0.5 text-xs font-semibold text-accent">
                    {actionLabel(e.action)}
                  </span>
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {e.targetType}
                  </span>
                  <span className="font-mono text-xs text-muted-strong">
                    {e.targetId}
                  </span>
                  <span className="ml-auto text-xs text-muted">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  Actor{" "}
                  <span className="text-accent">
                    {e.actorEmail || e.actorUserId}
                  </span>
                  {e.actorRole ? (
                    <span className="ml-1 text-xs text-muted">
                      ({e.actorRole})
                    </span>
                  ) : null}
                </p>
                {e.reason ? (
                  <p className="text-sm text-muted-strong">
                    Reason: {e.reason}
                  </p>
                ) : null}
                {e.meta != null ? (
                  <pre className="max-h-40 overflow-auto rounded-md border border-border/60 bg-background/60 p-2 text-[11px] leading-relaxed text-muted">
                    {JSON.stringify(e.meta, null, 2)}
                  </pre>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
