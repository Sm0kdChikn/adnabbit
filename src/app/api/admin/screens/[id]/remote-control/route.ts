import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import {
  appendPendingInput,
  isDeviceRecentlySeen,
  normalizeRemoteInputEvent,
  PLAYER_ONLINE_GRACE_MS,
  type RemoteInputEvent,
} from "@/lib/device";

type Ctx = { params: { id: string } };

/**
 * Ticket P.1 — admin queues mouse/keyboard/command events for the paired player.
 * Player drains via POST /api/device/input (and heartbeat signals inputPending).
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      device: {
        select: {
          id: true,
          lastSeenAt: true,
          pendingInputJson: true,
        },
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
        error: `Player appears offline (no heartbeat within ~${graceMin} min). Cannot send remote control.`,
      },
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    events?: unknown;
    event?: unknown;
    command?: unknown;
  } | null;

  const rawList: unknown[] = [];
  if (Array.isArray(body?.events)) {
    rawList.push(...body!.events);
  } else if (body?.event != null) {
    rawList.push(body.event);
  } else if (typeof body?.command === "string") {
    rawList.push({ type: "command", name: body.command });
  }

  if (rawList.length === 0) {
    return NextResponse.json(
      { error: "Provide events[], event, or command" },
      { status: 400 }
    );
  }
  if (rawList.length > 32) {
    return NextResponse.json(
      { error: "Too many events in one request (max 32)" },
      { status: 400 }
    );
  }

  const normalized: RemoteInputEvent[] = [];
  for (const raw of rawList) {
    const n = normalizeRemoteInputEvent(raw);
    if (!n) {
      return NextResponse.json(
        { error: "Invalid input event in payload" },
        { status: 400 }
      );
    }
    normalized.push(n);
  }

  // Re-read queue under a short race window (MVP; single-admin expected)
  const current = await prisma.device.findUnique({
    where: { id: screen.device.id },
    select: { pendingInputJson: true, lastSeenAt: true },
  });
  if (!current || !isDeviceRecentlySeen(current.lastSeenAt)) {
    return NextResponse.json(
      { error: "Player went offline" },
      { status: 409 }
    );
  }

  const appended = appendPendingInput(current.pendingInputJson, normalized);
  await prisma.device.update({
    where: { id: screen.device.id },
    data: { pendingInputJson: appended.json },
  });

  return NextResponse.json({
    ok: true,
    queued: normalized.length,
    queueLength: appended.queueLength,
    dropped: appended.dropped,
  });
}
