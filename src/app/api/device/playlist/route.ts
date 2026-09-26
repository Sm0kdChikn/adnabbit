import { NextResponse } from "next/server";
import { requireDeviceAuth } from "@/lib/device";
import { buildPlaylistForScreen } from "@/lib/playlist";
import { resolveOpenHoursForScreen } from "@/lib/open-hours";
import { resolveDownloadHoursForScreen } from "@/lib/download-hours";
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

  const [playlist, hours, downloadHours] = await Promise.all([
    buildPlaylistForScreen({
      screenId: auth.device.screenId,
      apiBase: apiBaseFromRequest(req),
      now,
    }),
    resolveOpenHoursForScreen(auth.device.screenId, now),
    resolveDownloadHoursForScreen(auth.device.screenId, now),
  ]);

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
    playbackAllowed: hours.isOpenNow,
  });
}

