import { NextResponse } from "next/server";
import { requireDeviceAuth } from "@/lib/device";
import { buildPlaylistForScreen } from "@/lib/playlist";
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

  const updated = await prisma.device.update({
    where: { id: auth.device.id },
    data: { lastSeenAt: new Date() },
    select: { playlistEpoch: true },
  });

  const playlist = await buildPlaylistForScreen({
    screenId: auth.device.screenId,
    apiBase: apiBaseFromRequest(req),
  });

  return NextResponse.json({
    screenId: auth.device.screenId,
    screenName: playlist.screenName,
    hostName: playlist.hostName,
    timezone: playlist.timezone,
    generatedAt: new Date().toISOString(),
    playlistEpoch: updated.playlistEpoch,
    items: playlist.items,
  });
}
