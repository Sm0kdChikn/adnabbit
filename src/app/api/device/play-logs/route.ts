import { NextResponse } from "next/server";
import { requireDeviceAuth } from "@/lib/device";
import { prisma } from "@/lib/prisma";
import { resolveOpenHoursForScreen } from "@/lib/open-hours";
import { resolveMaintenanceForScreen } from "@/lib/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_CAP = 100;

type IncomingEvent = {
  clientEventId?: unknown;
  creativeId?: unknown;
  scheduleId?: unknown;
  startedAt?: unknown;
  endedAt?: unknown;
  durationMs?: unknown;
  mimeType?: unknown;
  /** Legacy stub field — ignored */
  playedAt?: unknown;
};

type SkipReason =
  | "duplicate"
  | "invalid"
  | "creative_missing"
  | "creative_taken_down"
  | "advertiser_taken_down"
  | "screen_taken_down"
  | "host_taken_down"
  | "playback_not_allowed"
  | "schedule_mismatch";

type SkipRow = { clientEventId: string; reason: SkipReason };

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function asIsoDate(v: unknown): Date | null {
  const s = asString(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function asPositiveInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return Math.floor(v);
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}

function extractEvents(body: unknown): IncomingEvent[] {
  if (Array.isArray(body)) return body as IncomingEvent[];
  if (body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events)) {
    return (body as { events: IncomingEvent[] }).events;
  }
  return [];
}

/**
 * Ticket F2 — persist device play-logs (first-party PoP).
 * OptiSigns PlayEvent / CSV import path is untouched.
 * Prefer 200 with accepted/skipped/persisted — not all-or-nothing 403.
 */
export async function POST(req: Request) {
  const auth = await requireDeviceAuth(req);
  if (auth.error) return auth.error;

  const device = auth.device;
  const deviceId = device.id;
  const screenId = device.screenId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = extractEvents(body);
  if (raw.length === 0) {
    return NextResponse.json(
      { accepted: 0, persisted: 0, skipped: [] as SkipRow[] },
      { status: 200 }
    );
  }

  const events = raw.slice(0, BATCH_CAP);
  const skipped: SkipRow[] = [];
  let persisted = 0;

  const now = new Date();
  const [hours, maintenance, screen] = await Promise.all([
    resolveOpenHoursForScreen(screenId, now),
    resolveMaintenanceForScreen(screenId, now),
    prisma.screen.findUnique({
      where: { id: screenId },
      select: {
        playbackTakenDownAt: true,
        host: { select: { playbackTakenDownAt: true } },
      },
    }),
  ]);

  const playbackAllowed = !maintenance.active && hours.isOpenNow;
  const screenTakenDown = !!screen?.playbackTakenDownAt;
  const hostTakenDown = !!screen?.host?.playbackTakenDownAt;

  // Preload creatives + schedules referenced in batch
  const creativeIds = Array.from(
    new Set(
      events
        .map((e) => asString(e.creativeId))
        .filter((id): id is string => !!id)
    )
  );
  const scheduleIds = Array.from(
    new Set(
      events
        .map((e) => asString(e.scheduleId))
        .filter((id): id is string => !!id)
    )
  );
  const clientEventIds = Array.from(
    new Set(
      events
        .map((e) => asString(e.clientEventId))
        .filter((id): id is string => !!id)
    )
  );

  const [creatives, schedules, existingLogs] = await Promise.all([
    creativeIds.length
      ? prisma.creative.findMany({
          where: { id: { in: creativeIds } },
          select: {
            id: true,
            takenDownAt: true,
            advertiser: { select: { advertiserTakenDownAt: true } },
          },
        })
      : Promise.resolve([]),
    scheduleIds.length
      ? prisma.schedule.findMany({
          where: { id: { in: scheduleIds } },
          select: { id: true, screenId: true },
        })
      : Promise.resolve([]),
    clientEventIds.length
      ? prisma.playLog.findMany({
          where: {
            deviceId,
            clientEventId: { in: clientEventIds },
          },
          select: { clientEventId: true },
        })
      : Promise.resolve([]),
  ]);

  const creativeById = new Map(creatives.map((c) => [c.id, c]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  const seenClientIds = new Set(existingLogs.map((l) => l.clientEventId));

  for (const ev of events) {
    const clientEventId = asString(ev.clientEventId);
    if (!clientEventId) {
      skipped.push({ clientEventId: "", reason: "invalid" });
      continue;
    }

    if (seenClientIds.has(clientEventId)) {
      skipped.push({ clientEventId, reason: "duplicate" });
      continue;
    }
    // Within-batch de-dupe before insert
    seenClientIds.add(clientEventId);

    const creativeId = asString(ev.creativeId);
    const startedAt =
      asIsoDate(ev.startedAt) || asIsoDate(ev.playedAt);
    if (!creativeId || !startedAt) {
      skipped.push({ clientEventId, reason: "invalid" });
      continue;
    }

    if (!playbackAllowed) {
      skipped.push({ clientEventId, reason: "playback_not_allowed" });
      continue;
    }
    if (screenTakenDown) {
      skipped.push({ clientEventId, reason: "screen_taken_down" });
      continue;
    }
    if (hostTakenDown) {
      skipped.push({ clientEventId, reason: "host_taken_down" });
      continue;
    }

    const creative = creativeById.get(creativeId);
    if (!creative) {
      skipped.push({ clientEventId, reason: "creative_missing" });
      continue;
    }
    if (creative.takenDownAt) {
      skipped.push({ clientEventId, reason: "creative_taken_down" });
      continue;
    }
    if (creative.advertiser.advertiserTakenDownAt) {
      skipped.push({ clientEventId, reason: "advertiser_taken_down" });
      continue;
    }

    let scheduleId = asString(ev.scheduleId);
    if (scheduleId) {
      const sched = scheduleById.get(scheduleId);
      // Soft: if schedule missing or not on this screen, drop the ref and still persist
      if (!sched || sched.screenId !== screenId) {
        scheduleId = null;
      }
    }

    const endedAt = asIsoDate(ev.endedAt);
    let durationMs = asPositiveInt(ev.durationMs);
    if (durationMs == null && endedAt) {
      const delta = endedAt.getTime() - startedAt.getTime();
      if (delta >= 0) durationMs = delta;
    }

    try {
      await prisma.playLog.create({
        data: {
          deviceId,
          screenId,
          creativeId,
          scheduleId,
          startedAt,
          endedAt,
          durationMs,
          clientEventId,
        },
      });
      persisted += 1;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Unique constraint") || msg.includes("UNIQUE")) {
        skipped.push({ clientEventId, reason: "duplicate" });
      } else {
        console.error(`[play-logs] persist fail device=${deviceId}`, e);
        skipped.push({ clientEventId, reason: "invalid" });
      }
    }
  }

  return NextResponse.json(
    {
      accepted: events.length,
      persisted,
      skipped,
      truncated: raw.length > BATCH_CAP,
    },
    { status: 200 }
  );
}
