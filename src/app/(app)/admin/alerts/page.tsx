import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import {
  listFleetAlerts,
  scanFleetAlerts,
  countOpenFleetAlerts,
} from "@/lib/fleet";
import { ResolveAlertButton } from "./ResolveAlertButton";

export const dynamic = "force-dynamic";

export default async function AdminAlertsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  await scanFleetAlerts();

  const statusRaw = (searchParams.status || "OPEN").toUpperCase();
  const status =
    statusRaw === "ALL" || statusRaw === "RESOLVED" ? statusRaw : "OPEN";

  const [alerts, openCount] = await Promise.all([
    listFleetAlerts({
      status: status as "OPEN" | "RESOLVED" | "ALL",
      limit: 100,
    }),
    countOpenFleetAlerts(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet alerts"
        description="Offline (>5 min) and empty playlist while open. One open alert per screen + kind until resolved. Email later (TODO)."
        actions={
          <Link
            href="/admin/fleet"
            className="rounded-md border border-border bg-accent-dim px-3 py-1.5 text-sm text-accent hover:border-accent/40"
          >
            Fleet board
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["OPEN", "Open"],
            ["RESOLVED", "Resolved"],
            ["ALL", "All"],
          ] as const
        ).map(([id, label]) => (
          <Link
            key={id}
            href={id === "OPEN" ? "/admin/alerts" : `/admin/alerts?status=${id}`}
            className={`rounded-full px-3 py-1 font-medium ${
              status === id
                ? "bg-accent text-on-accent"
                : "border border-border text-muted hover:text-accent"
            }`}
          >
            {label}
            {id === "OPEN" ? ` (${openCount})` : ""}
          </Link>
        ))}
      </div>

      {alerts.length === 0 ? (
        <EmptyState>No alerts in this view.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li key={a.id}>
              <Card glow className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        a.kind === "OFFLINE"
                          ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {a.kind}
                    </span>
                    <span
                      className={`text-xs uppercase tracking-wide ${
                        a.status === "OPEN" ? "text-accent" : "text-muted"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <Link
                    href={`/admin/screens/${a.screenId}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    {a.screen.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {a.screen.host.name} · {a.screen.city}
                  </p>
                  {a.message ? (
                    <p className="text-xs text-muted-strong">{a.message}</p>
                  ) : null}
                  <p className="text-xs text-muted">
                    Opened {new Date(a.openedAt).toLocaleString()}
                    {a.resolvedAt
                      ? ` · Resolved ${new Date(a.resolvedAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                {a.status === "OPEN" ? (
                  <ResolveAlertButton alertId={a.id} />
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
