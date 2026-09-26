import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import {
  EmptyState,
  PageHeader,
  StatPill,
  StatRow,
} from "@/components/ui";
import { listFleetHealth, scanFleetAlerts, countOpenFleetAlerts } from "@/lib/fleet";
import { PLAYER_ONLINE_GRACE_MS } from "@/lib/device";
import { FleetFilterBar } from "./FleetFilterBar";
import { FleetBoard } from "./FleetBoard";

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

export default async function AdminFleetPage({
  searchParams,
}: {
  searchParams: { filter?: string; scan?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

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
            Multi-select for bulk refresh / reboot / kiosk.
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
        <FleetBoard screens={screens} />
      )}
    </div>
  );
}
