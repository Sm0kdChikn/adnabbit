import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { writeAuditEvent } from "@/lib/audit";
import {
  appendPendingInput,
  isDeviceRecentlySeen,
  normalizeRemoteInputEvent,
  PLAYER_ONLINE_GRACE_MS,
  type RemoteInputEvent,
} from "@/lib/device";

/**
 * Ticket U — admin fleet bulk ops. Fan-out existing single-device paths only:
 * refresh = bump playlistEpoch; reboot / kiosk = queue via pendingInputJson.
 * Per-device {ok|error} — never all-or-nothing.
 */

const ACTIONS = ["refresh", "reboot", "kioskLock", "kioskUnlock"] as const;
type BulkAction = (typeof ACTIONS)[number];

type BulkResult = {
  screenId: string;
  screenName?: string;
  ok: boolean;
  error?: string;
  playlistEpoch?: number;
  queued?: number;
};

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { action?: string; screenIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as BulkAction;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const screenIds = Array.isArray(body.screenIds)
    ? Array.from(
        new Set(
          body.screenIds.filter(
            (id): id is string => typeof id === "string" && id.length > 0
          )
        )
      )
    : [];
  if (screenIds.length === 0) {
    return NextResponse.json({ error: "screenIds required" }, { status: 400 });
  }
  if (screenIds.length > 100) {
    return NextResponse.json(
      { error: "Too many screens (max 100)" },
      { status: 400 }
    );
  }

  const screens = await prisma.screen.findMany({
    where: { id: { in: screenIds } },
    select: {
      id: true,
      name: true,
      device: {
        select: {
          id: true,
          lastSeenAt: true,
          playlistEpoch: true,
          pendingInputJson: true,
        },
      },
    },
  });
  const byId = new Map(screens.map((s) => [s.id, s]));
  const graceMin = Math.round(PLAYER_ONLINE_GRACE_MS / 60_000);
  const results: BulkResult[] = [];

  for (const screenId of screenIds) {
    const screen = byId.get(screenId);
    if (!screen) {
      results.push({ screenId, ok: false, error: "Screen not found" });
      continue;
    }
    if (!screen.device) {
      results.push({
        screenId,
        screenName: screen.name,
        ok: false,
        error: "No device paired",
      });
      continue;
    }
    if (!isDeviceRecentlySeen(screen.device.lastSeenAt)) {
      results.push({
        screenId,
        screenName: screen.name,
        ok: false,
        error: `Offline (no heartbeat within ~${graceMin} min)`,
      });
      continue;
    }

    try {
      if (action === "refresh") {
        const updated = await prisma.device.update({
          where: { id: screen.device.id },
          data: { playlistEpoch: { increment: 1 } },
          select: { playlistEpoch: true },
        });
        results.push({
          screenId,
          screenName: screen.name,
          ok: true,
          playlistEpoch: updated.playlistEpoch,
        });
        continue;
      }

      let events: RemoteInputEvent[] = [];
      if (action === "reboot") {
        const n = normalizeRemoteInputEvent({ type: "command", name: "reboot" });
        if (!n) throw new Error("Invalid reboot event");
        events = [n];
      } else if (action === "kioskLock") {
        const n = normalizeRemoteInputEvent({
          type: "command",
          name: "setKiosk",
          enabled: true,
        });
        if (!n) throw new Error("Invalid setKiosk event");
        events = [n];
      } else if (action === "kioskUnlock") {
        const n = normalizeRemoteInputEvent({
          type: "command",
          name: "setKiosk",
          enabled: false,
        });
        if (!n) throw new Error("Invalid setKiosk event");
        events = [n];
      }

      const current = await prisma.device.findUnique({
        where: { id: screen.device.id },
        select: { pendingInputJson: true, lastSeenAt: true },
      });
      if (!current || !isDeviceRecentlySeen(current.lastSeenAt)) {
        results.push({
          screenId,
          screenName: screen.name,
          ok: false,
          error: "Player went offline",
        });
        continue;
      }
      const appended = appendPendingInput(current.pendingInputJson, events);
      await prisma.device.update({
        where: { id: screen.device.id },
        data: { pendingInputJson: appended.json },
      });
      results.push({
        screenId,
        screenName: screen.name,
        ok: true,
        queued: events.length,
      });
    } catch (e) {
      results.push({
        screenId,
        screenName: screen.name,
        ok: false,
        error: e instanceof Error ? e.message : "Failed",
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  await writeAuditEvent({
    actorUserId: auth.user.id,
    action: "fleet.bulk",
    targetType: "fleet",
    targetId: action,
    reason: null,
    meta: {
      action,
      screenIds,
      okCount,
      failCount,
      results,
    },
  });

  return NextResponse.json({
    ok: true,
    action,
    okCount,
    failCount,
    results,
  });
}
