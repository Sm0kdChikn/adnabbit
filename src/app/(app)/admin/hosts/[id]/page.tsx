import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { HostForm } from "../HostForm";
import { InventoryBadge } from "@/components/StatusBadge";
import { formatVertical } from "@/lib/types";
import { AttachOwnerForm } from "../AttachOwnerForm";
import { OpenHoursEditorClient } from "@/components/OpenHoursEditorClient";
import {
  emptyWeekly,
  evaluateOpenState,
  formatHoursSummary,
  loadWeeklyForTarget,
} from "@/lib/open-hours";
import { resolveDownloadHoursForHost } from "@/lib/download-hours";
import { TakeDownPanel } from "@/components/TakeDownPanel";

export default async function EditHostPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const host = await prisma.host.findUnique({
    where: { id: params.id },
    include: {
      screens: { orderBy: { name: "asc" } },
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!host) notFound();

  const { weekly, rowCount } = await loadWeeklyForTarget("HOST", host.id);
  const alwaysOpen = rowCount === 0;
  const evaled = evaluateOpenState({
    timezone: host.timezone,
    weekly,
    alwaysOpen,
    forceLiveUntil: null,
  });
  const downloadHours = await resolveDownloadHoursForHost(host.id, host.timezone);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/hosts" className="text-sm text-accent hover:underline">
          ← Hosts
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Edit host</h1>
        <p className="text-sm text-muted">
          Vertical: {formatVertical(host.vertical, host.otherLabel)}
        </p>
      </div>

      <HostForm
        mode="edit"
        hostId={host.id}
        initial={{
          name: host.name,
          vertical: host.vertical,
          otherLabel: host.otherLabel,
          notes: host.notes,
          timezone: host.timezone,
        }}
      />

      <AttachOwnerForm hostId={host.id} current={host.user} />

      <TakeDownPanel
        target="host"
        id={host.id}
        takenDownAt={host.playbackTakenDownAt}
        reason={host.playbackTakenDownReason}
      />

      <OpenHoursEditorClient
        timezone={host.timezone}
        initialWeekly={alwaysOpen ? emptyWeekly() : weekly}
        summary={
          alwaysOpen
            ? "Always open (no hours set)"
            : formatHoursSummary(weekly)
        }
        isOpenNow={evaled.isOpenNow}
        savePath={`/api/admin/hosts/${host.id}/hours`}
      />

      <OpenHoursEditorClient
        timezone={host.timezone}
        initialWeekly={
          downloadHours.alwaysAllow ? emptyWeekly() : downloadHours.weekly
        }
        summary={downloadHours.summary}
        isOpenNow={downloadHours.downloadAllowed}
        savePath={`/api/admin/hosts/${host.id}/download-hours`}
        title="Download hours"
        description="Quiet hours outside this window — player plays from cache and defers new asset downloads. Empty = allow anytime. Timezone:"
        openNowLabel="Downloads allowed"
        closedNowLabel="Quiet (cache only)"
        clearButtonLabel="Allow anytime"
        clearOkMessage="Downloads allowed anytime (hours cleared)"
        saveButtonLabel="Save download hours"
        footerNote="Soft miss: per-screen override and bandwidth caps. Host timezone matches open hours."
        showOvernightPreset
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Screens ({host.screens.length})
          </h2>
          <Link
            href={`/admin/screens/new?hostId=${host.id}`}
            className="text-sm text-accent hover:underline"
          >
            Add screen
          </Link>
        </div>
        {host.screens.length === 0 ? (
          <p className="text-sm text-muted">No screens on this host yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {host.screens.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/admin/screens/${s.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {s.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {s.city}, {s.zip}
                  </p>
                </div>
                <InventoryBadge status={s.inventoryStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
