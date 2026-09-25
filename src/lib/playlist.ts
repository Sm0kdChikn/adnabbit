/**
 * Ticket J — build next-24h playlist items from ACTIVE schedules for a screen.
 * Reuses calendar-expand + schedules helpers; emits ISO UTC windows.
 */
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  expandSchedulesToBlocks,
  addYmd,
  type CalendarScheduleInput,
} from "./calendar-expand";
import { DEFAULT_TIMEZONE, materializeEndedSchedules } from "./schedules";
import { prisma } from "./prisma";

export type PlaylistItem = {
  scheduleId: string;
  creativeId: string;
  creativeName: string;
  mimeType: string;
  assetUrl: string;
  startAt: string;
  endAt: string;
  durationHintSec?: number;
};

function instantFromYmdMinutes(
  ymd: string,
  minutes: number,
  timeZone: string
): Date {
  if (minutes >= 24 * 60) {
    const next = addYmd(ymd, 1);
    return fromZonedTime(`${next} 00:00:00`, timeZone);
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hhmm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return fromZonedTime(`${ymd} ${hhmm}:00`, timeZone);
}

export async function buildPlaylistForScreen(opts: {
  screenId: string;
  apiBase: string;
  now?: Date;
  windowHours?: number;
}): Promise<{
  timezone: string;
  hostName: string;
  screenName: string;
  items: PlaylistItem[];
}> {
  const now = opts.now ?? new Date();
  const windowHours = opts.windowHours ?? 24;
  const windowEnd = addDays(now, windowHours / 24);

  await materializeEndedSchedules();

  const screen = await prisma.screen.findUnique({
    where: { id: opts.screenId },
    include: {
      host: { select: { name: true, timezone: true } },
    },
  });
  if (!screen) {
    return {
      timezone: DEFAULT_TIMEZONE,
      hostName: "",
      screenName: "",
      items: [],
    };
  }

  const tz = screen.host.timezone || DEFAULT_TIMEZONE;
  const rangeStart = formatInTimeZone(now, tz, "yyyy-MM-dd");
  // Include next calendar day so overnight / late windows are covered
  const rangeEnd = formatInTimeZone(windowEnd, tz, "yyyy-MM-dd");

  const schedules = await prisma.schedule.findMany({
    where: { screenId: opts.screenId, status: "ACTIVE" },
    include: {
      placement: {
        include: {
          creative: {
            select: {
              id: true,
              name: true,
              mimeType: true,
              status: true,
            },
          },
          advertiser: { select: { name: true, email: true } },
        },
      },
      screen: {
        include: {
          host: { select: { name: true, timezone: true } },
        },
      },
    },
  });

  const inputs: CalendarScheduleInput[] = schedules.map((s) => ({
    id: s.id,
    kind: s.kind,
    status: s.status,
    screenId: s.screenId,
    startAt: s.startAt,
    endAt: s.endAt,
    weekdays: s.weekdays,
    startTime: s.startTime,
    endTime: s.endTime,
    campaignStartDate: s.campaignStartDate,
    campaignEndDate: s.campaignEndDate,
    note: s.note,
    screen: {
      name: s.screen.name,
      host: {
        name: s.screen.host.name,
        timezone: s.screen.host.timezone,
      },
    },
    placement: {
      creative: { name: s.placement.creative.name },
      advertiser: s.placement.advertiser,
    },
  }));

  const blocks = expandSchedulesToBlocks(inputs, rangeStart, rangeEnd);
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const base = opts.apiBase.replace(/\/$/, "");

  const items: PlaylistItem[] = [];
  for (const b of blocks) {
    const startAt = instantFromYmdMinutes(b.dayYmd, b.startMinutes, tz);
    const endAt = instantFromYmdMinutes(b.dayYmd, b.endMinutes, tz);
    // Clip to [now, windowEnd)
    const clippedStart = startAt < now ? now : startAt;
    const clippedEnd = endAt > windowEnd ? windowEnd : endAt;
    if (!(clippedEnd > clippedStart)) continue;

    const sched = byId.get(b.scheduleId);
    if (!sched) continue;
    const creative = sched.placement.creative;
    if (creative.status !== "APPROVED") continue;

    const mime = creative.mimeType;
    const durationHintSec = mime.startsWith("image/")
      ? 10
      : mime.startsWith("video/")
        ? undefined
        : 10;

    items.push({
      scheduleId: b.scheduleId,
      creativeId: creative.id,
      creativeName: creative.name,
      mimeType: mime,
      assetUrl: `${base}/api/device/assets/${creative.id}`,
      startAt: clippedStart.toISOString(),
      endAt: clippedEnd.toISOString(),
      ...(durationHintSec !== undefined ? { durationHintSec } : {}),
    });
  }

  // Merge adjacent same-schedule blocks optionally left as separate items (fine for spike)
  items.sort((a, b) => a.startAt.localeCompare(b.startAt));

  return {
    timezone: tz,
    hostName: screen.host.name,
    screenName: screen.name,
    items,
  };
}

/** Creative IDs allowed for a device screen (ACTIVE now or recently scheduled). */
export async function allowedCreativeIdsForScreen(
  screenId: string,
  lookbackHours = 48
): Promise<Set<string>> {
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const rows = await prisma.schedule.findMany({
    where: {
      screenId,
      OR: [
        { status: "ACTIVE" },
        { status: "ENDED", updatedAt: { gte: since } },
        { status: "CANCELLED", cancelledAt: { gte: since } },
      ],
    },
    select: {
      placement: { select: { creativeId: true } },
    },
  });
  return new Set(rows.map((r) => r.placement.creativeId));
}
