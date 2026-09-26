/**
 * Ticket U — host download / quiet hours (sibling to OpenHours; do not overload open-hours).
 * Empty rows = allow downloads anytime (legacy-safe).
 * Outside window: player plays from cache; defers new asset prefetch.
 * Soft miss: per-screen override, bandwidth caps.
 */
import { prisma } from "./prisma";
import {
  emptyWeekly,
  evaluateOpenState,
  formatHoursSummary,
  validateWeekly,
  type WeeklyHourRow,
} from "./open-hours";
import { DEFAULT_TIMEZONE } from "./schedules";

export const DOWNLOAD_HOURS_SCOPE = "HOST" as const;

export type DownloadHoursPayload = {
  timezone: string;
  source: "host" | "none";
  weekly: WeeklyHourRow[];
  /** No rows configured → allow downloads anytime. */
  alwaysAllow: boolean;
  downloadAllowed: boolean;
  reason:
    | "always_allow"
    | "within_window"
    | "outside_window"
    | "closed_day";
  nextOpenAt: string | null;
  nextCloseAt: string | null;
  summary: string;
};

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export async function loadDownloadWeeklyForHost(
  hostId: string
): Promise<{ weekly: WeeklyHourRow[]; rowCount: number }> {
  const rows = await prisma.downloadHours.findMany({
    where: { scope: DOWNLOAD_HOURS_SCOPE, targetId: hostId },
    orderBy: { weekday: "asc" },
  });
  const byDay = new Map(rows.map((r) => [r.weekday, r]));
  const weekly = ALL_WEEKDAYS.map((weekday) => {
    const r = byDay.get(weekday);
    return {
      weekday,
      openTime: r?.openTime ?? null,
      closeTime: r?.closeTime ?? null,
    };
  });
  return { weekly, rowCount: rows.length };
}

export async function replaceDownloadWeeklyHours(
  hostId: string,
  weekly: WeeklyHourRow[]
) {
  const validated = validateWeekly(weekly);
  if (!validated.ok) throw new Error(validated.error);

  await prisma.$transaction(async (tx) => {
    await tx.downloadHours.deleteMany({
      where: { scope: DOWNLOAD_HOURS_SCOPE, targetId: hostId },
    });
    await tx.downloadHours.createMany({
      data: validated.weekly.map((r) => ({
        scope: DOWNLOAD_HOURS_SCOPE,
        targetId: hostId,
        weekday: r.weekday,
        openTime: r.openTime,
        closeTime: r.closeTime,
      })),
    });
  });

  return validated.weekly;
}

export async function clearDownloadWeeklyHours(hostId: string) {
  await prisma.downloadHours.deleteMany({
    where: { scope: DOWNLOAD_HOURS_SCOPE, targetId: hostId },
  });
}

function mapReason(
  reason: ReturnType<typeof evaluateOpenState>["reason"]
): DownloadHoursPayload["reason"] {
  switch (reason) {
    case "always_open":
      return "always_allow";
    case "within_hours":
    case "force_live":
      return "within_window";
    case "outside_hours":
      return "outside_window";
    case "closed_day":
      return "closed_day";
    default:
      return "always_allow";
  }
}

export async function resolveDownloadHoursForScreen(
  screenId: string,
  now = new Date()
): Promise<DownloadHoursPayload> {
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: {
      id: true,
      host: { select: { id: true, timezone: true } },
    },
  });
  if (!screen) {
    return {
      timezone: DEFAULT_TIMEZONE,
      source: "none",
      weekly: emptyWeekly(),
      alwaysAllow: true,
      downloadAllowed: true,
      reason: "always_allow",
      nextOpenAt: null,
      nextCloseAt: null,
      summary: "Always allow (no hours set)",
    };
  }

  const tz = screen.host.timezone || DEFAULT_TIMEZONE;
  const { weekly, rowCount } = await loadDownloadWeeklyForHost(screen.host.id);
  const alwaysAllow = rowCount === 0;
  const evaled = evaluateOpenState({
    timezone: tz,
    weekly,
    alwaysOpen: alwaysAllow,
    forceLiveUntil: null,
    now,
  });

  return {
    timezone: tz,
    source: alwaysAllow ? "none" : "host",
    weekly,
    alwaysAllow,
    downloadAllowed: evaled.isOpenNow,
    reason: mapReason(evaled.reason),
    nextOpenAt: evaled.nextOpenAt,
    nextCloseAt: evaled.nextCloseAt,
    summary: alwaysAllow
      ? "Always allow (no hours set)"
      : formatHoursSummary(weekly),
  };
}

export async function resolveDownloadHoursForHost(
  hostId: string,
  timezone: string,
  now = new Date()
): Promise<DownloadHoursPayload> {
  const tz = timezone || DEFAULT_TIMEZONE;
  const { weekly, rowCount } = await loadDownloadWeeklyForHost(hostId);
  const alwaysAllow = rowCount === 0;
  const evaled = evaluateOpenState({
    timezone: tz,
    weekly,
    alwaysOpen: alwaysAllow,
    forceLiveUntil: null,
    now,
  });
  return {
    timezone: tz,
    source: alwaysAllow ? "none" : "host",
    weekly: alwaysAllow ? emptyWeekly() : weekly,
    alwaysAllow,
    downloadAllowed: evaled.isOpenNow,
    reason: mapReason(evaled.reason),
    nextOpenAt: evaled.nextOpenAt,
    nextCloseAt: evaled.nextCloseAt,
    summary: alwaysAllow
      ? "Always allow (no hours set)"
      : formatHoursSummary(weekly),
  };
}

/** Overnight 00:00–06:00 every day — typical quiet-hours allow window. */
export function presetOvernightDownload(): WeeklyHourRow[] {
  return ALL_WEEKDAYS.map((weekday) => ({
    weekday,
    openTime: "00:00",
    closeTime: "06:00",
  }));
}
