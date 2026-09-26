import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { HostVenueForm } from "../HostVenueForm";
import { OpenHoursEditorClient } from "@/components/OpenHoursEditorClient";
import {
  emptyWeekly,
  evaluateOpenState,
  formatHoursSummary,
  loadWeeklyForTarget,
} from "@/lib/open-hours";
import { resolveDownloadHoursForHost } from "@/lib/download-hours";

export default async function HostEditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "HOST") redirect("/dashboard");

  const host = await prisma.host.findUnique({
    where: { userId: session.user.id },
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
    <div className="space-y-6">
      <div>
        <Link href="/host" className="text-sm text-accent hover:underline">
          ← Host portal
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Edit venue</h1>
        <p className="text-sm text-muted">
          Update name, vertical, timezone, offline play policy, notes, open hours, and download hours.
        </p>
      </div>
      <HostVenueForm
        initial={{
          name: host.name,
          vertical: host.vertical,
          otherLabel: host.otherLabel,
          notes: host.notes,
          timezone: host.timezone,
          offlinePolicy: host.offlinePolicy,
          offlineCacheTtlHours: host.offlineCacheTtlHours,
        }}
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
        savePath="/api/host/hours"
      />
      <OpenHoursEditorClient
        timezone={host.timezone}
        initialWeekly={
          downloadHours.alwaysAllow ? emptyWeekly() : downloadHours.weekly
        }
        summary={downloadHours.summary}
        isOpenNow={downloadHours.downloadAllowed}
        savePath="/api/host/download-hours"
        title="Download hours"
        description="Quiet hours outside this window — player plays from cache and defers new asset downloads. Empty = allow anytime. Timezone:"
        openNowLabel="Downloads allowed"
        closedNowLabel="Quiet (cache only)"
        clearButtonLabel="Allow anytime"
        clearOkMessage="Downloads allowed anytime (hours cleared)"
        saveButtonLabel="Save download hours"
        footerNote="Host timezone matches open hours. Soft miss: per-screen override."
        showOvernightPreset
      />
    </div>
  );
}
