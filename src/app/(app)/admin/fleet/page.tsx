import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { DeviceStatusBadge } from "@/components/DeviceStatusBadge";
import {
  Card,
  CardList,
  CardListItem,
  EmptyState,
  PageHeader,
  StatPill,
  StatRow,
} from "@/components/ui";
import { listFleetHealth, scanFleetAlerts, countOpenFleetAlerts } from "@/lib/fleet";
import { PLAYER_ONLINE_GRACE_MS } from "@/lib/device";
import { FleetFilterBar } from "./FleetFilterBar";

export const dynamic = "force-dynamic";

type Filter = "all" | "offline" | "empty" | "version" | "attention";

function parseFilter(raw?: string): Filter {
  const v = (raw || "all").toLowerCase();
  if (
    v === "offline" ||
    v === "empty" ||
    v === "version" ||
    v === "attention"
  ) {
    return v;
  }
  return "all";
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function versionLabel(status: string, version: string | null): string {
  if (status === "missing") return "Version unknown";
  if (status === "lag") return `${version} (behind)`;
  if (status === "unknown") return version || "—";
  return version || "—";
}

export default async function AdminFleetPage({
  searchParams,
}: {
  searchParams: { filter?: string; scan?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  // Lightweight scan on each visit (also POST /api/admin/fleet for cron)
  await scanFleetAlerts();

  const filter = parseFilter(searchParams.filter);
  const all = await listFleetHealth();
  const openAlerts = await countOpenFleetAlerts();

  const counts = {
    all: all.length,
    offline: all.filter((s) => !s.online).length,
    empty: all.filter((s) => s.emptyPlaylist).length,
    version: all.filter(
      (s) => s.versionStatus === "missing" || s.versionStatus === "lag"
    ).length,
    attention: all.filter((s) => s.attention).length,
  };

  let screens = all;
  if (filter === "offline") screens = all.filter((s) => !s.online);
  else if (filter === "empty") screens = all.filter((s) => s.emptyPlaylist);
  else if (filter === "version")
    screens = all.filter(
      (s) => s.versionStatus === "missing" || s.versionStatus === "lag"
    );
  else if (filter === "attention") screens = all.filter((s) => s.attention);

  const graceMin = PLAYER_ONLINE_GRACE_MS / 60000;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet health"
        description={
          <>
            Paired screens — online if heartbeat within {graceMin} min. Empty =
            open hours + 0 active playlist items. Closed hours is not a fault.
          </>
        }
        actions={
          <Link
            href="/admin/alerts"
            className="rounded-md border border-border bg-accent-dim px-3 py-1.5 text-sm text-accent hover:border-accent/40"
          >
            Alerts{openAlerts > 0 ? ` (${openAlerts})` : ""}
          </Link>
        }
      />

      <StatRow>
        <StatPill label="Paired" value={counts.all} />
        <StatPill label="Offline" value={counts.offline} />
        <StatPill label="Empty" value={counts.empty} />
        <StatPill label="Open alerts" value={openAlerts} />
      </StatRow>

      <Suspense fallback={null}>
        <FleetFilterBar filter={filter} counts={counts} />
      </Suspense>

      {screens.length === 0 ? (
        <EmptyState>
          {all.length === 0
            ? "No paired screens yet. Claim a device from a screen detail page."
            : "No screens match this filter."}
        </EmptyState>
      ) : (
        <CardList>
          {screens.map((s) => (
            <CardListItem key={s.screenId}>
              <Card
                glow
                className={`flex h-full flex-col p-4 ${
                  !s.online || s.emptyPlaylist
                    ? "ring-1 ring-[var(--status-danger-fg)]/30"
                    : ""
                }`}
              >
                <div className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={`/admin/screens/${s.screenId}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        {s.screenName}
                      </Link>
                      <p className="text-sm text-muted">
                        {s.city}, {s.zip} ·{" "}
                        <Link
                          href={`/admin/hosts/${s.hostId}`}
                          className="hover:text-accent"
                        >
                          {s.hostName}
                        </Link>
                      </p>
                    </div>
                    <DeviceStatusBadge status={s.displayStatus} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-strong">Last seen</dt>
                      <dd className="text-foreground">
                        {formatLastSeen(s.lastSeenAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-strong">Hours</dt>
                      <dd className="text-foreground">
                        {s.playbackAllowed
                          ? s.forceLiveActive
                            ? "Open (force live)"
                            : "Open"
                          : "Closed hours"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-strong">Active items</dt>
                      <dd className="text-foreground">
                        {s.activeItemCount}
                        {s.emptyPlaylist ? (
                          <span className="ml-1 text-amber-300">· empty</span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-strong">Player</dt>
                      <dd className="text-foreground">
                        {versionLabel(s.versionStatus, s.playerVersion)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-strong">Disk</dt>
                      <dd className="text-foreground">
                        {s.diskCritical === true
                          ? "Critical"
                          : s.diskFreeBytes != null
                            ? `${Math.round(s.diskFreeBytes / (1024 * 1024))} MB free`
                            : "— (TODO)"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-strong">Playback</dt>
                      <dd className="text-foreground">
                        {s.playbackState || "—"}
                      </dd>
                    </div>
                  </dl>

                  {s.openAlertKinds.length > 0 ? (
                    <p className="text-xs text-[var(--status-danger-fg)]">
                      Open alert: {s.openAlertKinds.join(", ")}
                    </p>
                  ) : null}
                </div>
              </Card>
            </CardListItem>
          ))}
        </CardList>
      )}
    </div>
  );
}
