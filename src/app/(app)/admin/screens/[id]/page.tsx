import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ScreenForm } from "../ScreenForm";
import { formatVertical } from "@/lib/types";
import { ClaimDevicePanel } from "@/components/ClaimDevicePanel";
import { RemoteViewPanel } from "@/components/RemoteViewPanel";
import { isDeviceRecentlySeen } from "@/lib/device";
import { OpenHoursEditorClient } from "@/components/OpenHoursEditorClient";
import { DeviceStatusBadge } from "@/components/DeviceStatusBadge";
import {
  deriveDeviceDisplayStatus,
  formatHoursSummary,
  resolveOpenHoursForScreen,
} from "@/lib/open-hours";

export default async function EditScreenPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const screen = await prisma.screen.findUnique({
    where: { id: params.id },
    include: {
      host: { select: { id: true, name: true, vertical: true, otherLabel: true, timezone: true } },
      device: true,
    },
  });
  if (!screen) notFound();

  const hours = await resolveOpenHoursForScreen(screen.id);
  const online = isDeviceRecentlySeen(screen.device?.lastSeenAt);
  const displayStatus = deriveDeviceDisplayStatus({
    hasDevice: !!screen.device,
    online,
    hours,
    playbackState: screen.device?.playbackState,
  });

  const hosts = await prisma.host.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, vertical: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/screens" className="text-sm text-accent hover:underline">
          ← Screens
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Edit screen</h1>
        <p className="text-sm text-muted">
          Host vertical (inherited):{" "}
          {formatVertical(screen.host.vertical, screen.host.otherLabel)}
        </p>
      </div>
      <ClaimDevicePanel
        screenId={screen.id}
        role="admin"
        displayStatus={displayStatus}
        device={
          screen.device
            ? {
                id: screen.device.id,
                name: screen.device.name,
                lastSeenAt: screen.device.lastSeenAt?.toISOString() ?? null,
                claimedAt: screen.device.claimedAt.toISOString(),
              }
            : null
        }
      />
      <RemoteViewPanel
        screenId={screen.id}
        hasDevice={!!screen.device}
        deviceOnline={online}
        displayStatus={displayStatus}
        hoursOpen={hours.isOpenNow}
        hoursSummary={
          hours.alwaysOpen
            ? "Always open"
            : formatHoursSummary(hours.weekly)
        }
        forceLiveUntil={hours.forceLiveUntil}
      />
      <OpenHoursEditorClient
        timezone={hours.timezone}
        initialWeekly={hours.weekly}
        showCustomToggle
        useCustomHours={hours.useCustomHours}
        showForceLive
        forceLiveUntil={hours.forceLiveUntil}
        summary={
          hours.alwaysOpen
            ? "Always open (no hours set)"
            : formatHoursSummary(hours.weekly)
        }
        isOpenNow={hours.isOpenNow}
        savePath={`/api/admin/screens/${screen.id}/hours`}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Device status:</span>
        <DeviceStatusBadge status={displayStatus} />
      </div>
      <ScreenForm
        mode="edit"
        screenId={screen.id}
        hosts={hosts}
        initial={{
          name: screen.name,
          city: screen.city,
          zip: screen.zip,
          inventoryStatus: screen.inventoryStatus,
          notes: screen.notes,
          hostId: screen.hostId,
        }}
      />
    </div>
  );
}
