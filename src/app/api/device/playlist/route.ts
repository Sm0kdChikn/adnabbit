import { NextResponse } from "next/server";
import { requireDeviceAuth } from "@/lib/device";
import { buildPlaylistForScreen } from "@/lib/playlist";
import { resolveOpenHoursForScreen } from "@/lib/open-hours";
import { resolveDownloadHoursForScreen } from "@/lib/download-hours";
import { resolveOfflinePolicyForScreen } from "@/lib/offline-policy";
import { resolveMaintenanceForScreen } from "@/lib/maintenance";
import {
  resolveOutputForScreen,
  toOutputWire,
} from "@/lib/output";
import { prisma } from "@/lib/prisma";

function apiBaseFromRequest(req: Request): string {
  const env = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (env) return env;
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(req: Request) {
  const auth = await requireDeviceAuth(req);
  if (auth.error) return auth.error;

  const now = new Date();
  const updated = await prisma.device.update({
    where: { id: auth.device.id },
    data: { lastSeenAt: now },
    select: { playlistEpoch: true },
  });

  const [playlist, hours, downloadHours, offlinePolicy, maintenance, resolvedOutput] =
    await Promise.all([
      buildPlaylistForScreen({
        screenId: auth.device.screenId,
        apiBase: apiBaseFromRequest(req),
        now,
      }),
      resolveOpenHoursForScreen(auth.device.screenId, now),
      resolveDownloadHoursForScreen(auth.device.screenId, now),
      resolveOfflinePolicyForScreen(auth.device.screenId),
      resolveMaintenanceForScreen(auth.device.screenId, now),
      resolveOutputForScreen(auth.device.screenId),
    ]);

  const playbackAllowed = !maintenance.active && hours.isOpenNow;

  return NextResponse.json({
    screenId: auth.device.screenId,
    screenName: playlist.screenName,
    hostName: playlist.hostName,
    timezone: playlist.timezone,
    generatedAt: now.toISOString(),
    playlistEpoch: updated.playlistEpoch,
    items: playlist.items,
    hours,
    downloadHours,
    downloadAllowed: downloadHours.downloadAllowed,
    playbackAllowed,
    // Ticket X
    maintenance: {
      active: maintenance.active,
      endsAt: maintenance.endsAt ?? undefined,
      scope: maintenance.scope ?? undefined,
      note: maintenance.note ?? undefined,
    },
    statusReason: maintenance.active
      ? "MAINTENANCE"
      : hours.isOpenNow
        ? hours.forceLiveActive
          ? "FORCE_LIVE"
          : "OPEN"
        : "CLOSED_HOURS",
    // Ticket V
    offlinePolicy: offlinePolicy.offlinePolicy,
    offlineCacheTtlHours: offlinePolicy.offlineCacheTtlHours,
    // Ticket Y
    output: toOutputWire(resolvedOutput),
  });
}

