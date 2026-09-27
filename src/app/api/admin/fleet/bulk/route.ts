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
import { listDeviceIdsInGroup } from "@/lib/device-groups";
import {
  parseOutputLevel,
  resolveOutputForScreen,
} from "@/lib/output";

/**
 * Ticket U — admin fleet bulk ops. Ticket Z — target via groupId OR deviceIds[]
 * (or legacy screenIds). Fan-out: refresh / reboot / kiosk / setOutput.
 * Per-device {ok|error} — never all-or-nothing.
 */

const ACTIONS = [
  "refresh",
  "reboot",
  "kioskLock",
  "kioskUnlock",
  "setOutput",
] as const;
type BulkAction = (typeof ACTIONS)[number];

type BulkResult = {
  screenId: string;
  deviceId?: string;
  screenName?: string;
  ok: boolean;
  error?: string;
  playlistEpoch?: number;
  queued?: number;
  volume?: number;
  brightness?: number;
};

function parseIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw.filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );
}

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: {
    action?: string;
    screenIds?: unknown;
    deviceIds?: unknown;
    groupId?: unknown;
    volume?: unknown;
    brightness?: unknown;
  };
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

  const groupId =
    typeof body.groupId === "string" && body.groupId.trim()
      ? body.groupId.trim()
      : null;
  const deviceIdsIn = parseIdList(body.deviceIds);
  const screenIdsIn = parseIdList(body.screenIds);

  const targetKinds = [groupId ? 1 : 0, deviceIdsIn.length ? 1 : 0, screenIdsIn.length ? 1 : 0].reduce(
    (a, b) => a + b,
    0
  );
  if (targetKinds === 0) {
    return NextResponse.json(
      { error: "Provide groupId, deviceIds[], or screenIds[]" },
      { status: 400 }
    );
  }
  if (targetKinds > 1) {
    return NextResponse.json(
      { error: "Provide exactly one of groupId, deviceIds[], or screenIds[]" },
      { status: 400 }
    );
  }

  let setVolume: number | undefined;
  let setBrightness: number | undefined;
  if (action === "setOutput") {
    const vol = parseOutputLevel(body.volume, "volume");
    if (!vol.ok) {
      return NextResponse.json({ error: vol.error }, { status: 400 });
    }
    const bri = parseOutputLevel(body.brightness, "brightness");
    if (!bri.ok) {
      return NextResponse.json({ error: bri.error }, { status: 400 });
    }
    // null = not allowed for bulk (would clear sticky); require number or omit (resolve)
    if (vol.value === null || bri.value === null) {
      return NextResponse.json(
        { error: "Bulk setOutput cannot clear sticky (null); omit to use resolved prefs" },
        { status: 400 }
      );
    }
    if (typeof vol.value === "number") setVolume = vol.value;
    if (typeof bri.value === "number") setBrightness = bri.value;
  }

  // Resolve to screen rows with devices
  type ScreenRow = {
    id: string;
    name: string;
    device: {
      id: string;
      lastSeenAt: Date | null;
      playlistEpoch: number;
      pendingInputJson: string | null;
    } | null;
  };

  let screens: ScreenRow[] = [];
  let resolvedFrom: "groupId" | "deviceIds" | "screenIds";

  if (groupId) {
    const group = await prisma.deviceGroup.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    const memberDeviceIds = await listDeviceIdsInGroup(groupId);
    if (memberDeviceIds.length === 0) {
      return NextResponse.json({
        ok: true,
        action,
        okCount: 0,
        failCount: 0,
        results: [],
        message: "Group has no members",
      });
    }
    if (memberDeviceIds.length > 100) {
      return NextResponse.json(
        { error: "Too many devices in group (max 100)" },
        { status: 400 }
      );
    }
    screens = await prisma.screen.findMany({
      where: { device: { id: { in: memberDeviceIds } } },
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
    resolvedFrom = "groupId";
  } else if (deviceIdsIn.length > 0) {
    if (deviceIdsIn.length > 100) {
      return NextResponse.json(
        { error: "Too many devices (max 100)" },
        { status: 400 }
      );
    }
    screens = await prisma.screen.findMany({
      where: { device: { id: { in: deviceIdsIn } } },
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
    // Include missing deviceIds as errors later via byDevice map
    resolvedFrom = "deviceIds";
  } else {
    if (screenIdsIn.length > 100) {
      return NextResponse.json(
        { error: "Too many screens (max 100)" },
        { status: 400 }
      );
    }
    screens = await prisma.screen.findMany({
      where: { id: { in: screenIdsIn } },
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
    resolvedFrom = "screenIds";
  }

  const byScreenId = new Map(screens.map((s) => [s.id, s]));
  const byDeviceId = new Map(
    screens.filter((s) => s.device).map((s) => [s.device!.id, s])
  );

  // Ordered work list
  type WorkItem = { screenId: string; deviceId?: string; screen?: ScreenRow };
  const work: WorkItem[] = [];

  if (resolvedFrom === "screenIds") {
    for (const screenId of screenIdsIn) {
      work.push({ screenId, screen: byScreenId.get(screenId) });
    }
  } else if (resolvedFrom === "deviceIds") {
    for (const deviceId of deviceIdsIn) {
      const screen = byDeviceId.get(deviceId);
      if (!screen) {
        work.push({ screenId: "", deviceId });
      } else {
        work.push({
          screenId: screen.id,
          deviceId,
          screen,
        });
      }
    }
  } else {
    // groupId — all found screens (members are paired by definition)
    for (const s of screens) {
      work.push({
        screenId: s.id,
        deviceId: s.device?.id,
        screen: s,
      });
    }
  }

  const graceMin = Math.round(PLAYER_ONLINE_GRACE_MS / 60_000);
  const results: BulkResult[] = [];

  for (const item of work) {
    if (resolvedFrom === "deviceIds" && !item.screen) {
      results.push({
        screenId: "",
        deviceId: item.deviceId,
        ok: false,
        error: "Device not found",
      });
      continue;
    }
    const screen = item.screen;
    if (!screen) {
      results.push({
        screenId: item.screenId,
        ok: false,
        error: "Screen not found",
      });
      continue;
    }
    if (!screen.device) {
      results.push({
        screenId: screen.id,
        screenName: screen.name,
        ok: false,
        error: "No device paired",
      });
      continue;
    }
    if (!isDeviceRecentlySeen(screen.device.lastSeenAt)) {
      results.push({
        screenId: screen.id,
        deviceId: screen.device.id,
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
          screenId: screen.id,
          deviceId: screen.device.id,
          screenName: screen.name,
          ok: true,
          playlistEpoch: updated.playlistEpoch,
        });
        continue;
      }

      if (action === "setOutput") {
        let volume = setVolume;
        let brightness = setBrightness;
        if (volume === undefined || brightness === undefined) {
          const resolved = await resolveOutputForScreen(screen.id);
          if (volume === undefined) volume = resolved.volume;
          if (brightness === undefined) brightness = resolved.brightness;
        }
        const n = normalizeRemoteInputEvent({
          type: "command",
          name: "setOutput",
          volume,
          brightness,
        });
        if (!n) throw new Error("Invalid setOutput event");
        const current = await prisma.device.findUnique({
          where: { id: screen.device.id },
          select: { pendingInputJson: true, lastSeenAt: true },
        });
        if (!current || !isDeviceRecentlySeen(current.lastSeenAt)) {
          results.push({
            screenId: screen.id,
            deviceId: screen.device.id,
            screenName: screen.name,
            ok: false,
            error: "Player went offline",
          });
          continue;
        }
        const appended = appendPendingInput(current.pendingInputJson, [n]);
        await prisma.device.update({
          where: { id: screen.device.id },
          data: { pendingInputJson: appended.json },
        });
        results.push({
          screenId: screen.id,
          deviceId: screen.device.id,
          screenName: screen.name,
          ok: true,
          queued: 1,
          volume,
          brightness,
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
          screenId: screen.id,
          deviceId: screen.device.id,
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
        screenId: screen.id,
        deviceId: screen.device.id,
        screenName: screen.name,
        ok: true,
        queued: events.length,
      });
    } catch (e) {
      results.push({
        screenId: screen.id,
        deviceId: screen.device.id,
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
      resolvedFrom,
      groupId: groupId || undefined,
      deviceIds: deviceIdsIn.length ? deviceIdsIn : undefined,
      screenIds: screenIdsIn.length ? screenIdsIn : undefined,
      volume: setVolume,
      brightness: setBrightness,
      okCount,
      failCount,
      results,
    },
  });

  return NextResponse.json({
    ok: true,
    action,
    resolvedFrom,
    groupId: groupId || undefined,
    okCount,
    failCount,
    results,
  });
}
