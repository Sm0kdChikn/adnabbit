import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { isDeviceRecentlySeen, PLAYER_ONLINE_GRACE_MS } from "@/lib/device";

type Ctx = { params: { id: string } };

/** Ticket O — bump Device.playlistEpoch so the paired player re-fetches ASAP. */
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      device: {
        select: { id: true, lastSeenAt: true, playlistEpoch: true },
      },
    },
  });
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }
  if (!screen.device) {
    return NextResponse.json(
      { error: "No device paired to this screen" },
      { status: 409 }
    );
  }
  if (!isDeviceRecentlySeen(screen.device.lastSeenAt)) {
    const graceMin = Math.round(PLAYER_ONLINE_GRACE_MS / 60_000);
    return NextResponse.json(
      {
        error: `Player appears offline (no heartbeat within ~${graceMin} min). Cannot force refresh.`,
      },
      { status: 409 }
    );
  }

  const updated = await prisma.device.update({
    where: { id: screen.device.id },
    data: { playlistEpoch: { increment: 1 } },
    select: { playlistEpoch: true },
  });

  return NextResponse.json({
    ok: true,
    playlistEpoch: updated.playlistEpoch,
  });
}
