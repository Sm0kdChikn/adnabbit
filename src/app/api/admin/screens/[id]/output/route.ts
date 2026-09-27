import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import {
  parseOutputLevel,
  resolveOutputLevels,
  saveAndMaybeApplyScreenOutput,
  toOutputWire,
} from "@/lib/output";

type Ctx = { params: { id: string } };

/**
 * Ticket Y — sticky volume/brightness prefs + optional setOutput queue.
 * GET: resolved + sticky + last-applied from heartbeat.
 * PATCH: save sticky (null clears inherit) and/or apply to player.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      volume: true,
      brightness: true,
      host: {
        select: {
          id: true,
          name: true,
          defaultVolume: true,
          defaultBrightness: true,
        },
      },
      device: {
        select: {
          id: true,
          lastSeenAt: true,
          lastAppliedVolume: true,
          lastAppliedBrightness: true,
        },
      },
    },
  });
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  const resolved = resolveOutputLevels({
    screenVolume: screen.volume,
    screenBrightness: screen.brightness,
    hostDefaultVolume: screen.host.defaultVolume,
    hostDefaultBrightness: screen.host.defaultBrightness,
  });

  return NextResponse.json({
    screenId: screen.id,
    screenName: screen.name,
    hostId: screen.host.id,
    hostName: screen.host.name,
    sticky: {
      volume: screen.volume,
      brightness: screen.brightness,
    },
    hostDefaults: {
      volume: screen.host.defaultVolume,
      brightness: screen.host.defaultBrightness,
    },
    resolved: toOutputWire(resolved),
    lastApplied: screen.device
      ? {
          volume: screen.device.lastAppliedVolume,
          brightness: screen.device.lastAppliedBrightness,
        }
      : null,
    paired: !!screen.device,
    lastSeenAt: screen.device?.lastSeenAt?.toISOString() ?? null,
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: {
    volume?: unknown;
    brightness?: unknown;
    apply?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const vol = parseOutputLevel(body.volume, "volume");
  if (!vol.ok) {
    return NextResponse.json({ error: vol.error }, { status: 400 });
  }
  const bri = parseOutputLevel(body.brightness, "brightness");
  if (!bri.ok) {
    return NextResponse.json({ error: bri.error }, { status: 400 });
  }

  if (vol.value === undefined && bri.value === undefined && body.apply !== true) {
    return NextResponse.json(
      { error: "Provide volume, brightness, and/or apply:true" },
      { status: 400 }
    );
  }

  const apply = body.apply === true;

  // apply:true with no sticky change → re-queue current resolved levels
  const result = await saveAndMaybeApplyScreenOutput({
    screenId: params.id,
    actorUserId: auth.user.id,
    volume: vol.value,
    brightness: bri.value,
    apply,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        prefsSaved: result.prefsSaved ?? false,
        resolved: result.resolved
          ? toOutputWire(result.resolved)
          : undefined,
      },
      { status: result.status }
    );
  }

  // Re-read last-applied for response
  const device = await prisma.device.findUnique({
    where: { screenId: params.id },
    select: {
      lastAppliedVolume: true,
      lastAppliedBrightness: true,
    },
  });

  return NextResponse.json({
    ok: true,
    queued: result.queued,
    queueLength: result.queueLength,
    dropped: result.dropped,
    resolved: toOutputWire(result.resolved),
    sticky: {
      volume: result.resolved.screenVolume,
      brightness: result.resolved.screenBrightness,
    },
    lastApplied: device
      ? {
          volume: device.lastAppliedVolume,
          brightness: device.lastAppliedBrightness,
        }
      : null,
  });
}
