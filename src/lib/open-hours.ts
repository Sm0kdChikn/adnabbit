/**
 * Ticket Q — venue / screen open hours, soft blackout, force-live override.
 * Soft blackout = black + idle (no PoP). Hard display-off = TODO.
 */
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "./prisma";
import {
  DEFAULT_TIMEZONE,
  formatMinutes,
  parseHHMM,
  WEEKDAY_LABELS,
  zonedParts,
} from "./schedules";

export const OPEN_HOURS_SCOPES = ["HOST", "SCREEN"] as const;
export type OpenHoursScope = (typeof OPEN_HOURS_SCOPES)[number];

/** Soft only for MVP; HARD = display power-off stub. */
export const BLACKOUT_MODE = "SOFT" as const;

export type WeeklyHourRow = {
  weekday: number;
  openTime: string | null;
  closeTime: string | null;
};

export type OpenHoursPayload = {
  timezone: string;
  source: "host" | "screen" | "none";
  useCustomHours: boolean;
  weekly: WeeklyHourRow[];
  /** True when no hours rows exist for the effective scope → always open. */
  alwaysOpen: boolean;
  forceLiveUntil: string | null;
  forceLiveActive: boolean;
  isOpenNow: boolean;
  /** Why the screen is considered open/closed right now. */
  reason:
    | "always_open"
    | "force_live"
    | "within_hours"
    | "outside_hours"
    | "closed_day";
  nextOpenAt: string | null;
  nextCloseAt: string | null;
  /** SOFT | HARD — HARD not implemented. */
  blackoutMode: typeof BLACKOUT_MODE;
};

export type DeviceDisplayStatus =
  | "UNPAIRED"
  | "OFFLINE"
  | "LIVE"
  | "BLACKOUT"
  | "IDLE"
  | "EMPTY";

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function emptyWeekly(): WeeklyHourRow[] {
  return ALL_WEEKDAYS.map((weekday) => ({
    weekday,
    openTime: null,
    closeTime: null,
  }));
}

/** Validate a single day row. Closed = both null. Open = both HH:mm with end > start. */
export function validateHourRow(
  row: WeeklyHourRow
): { ok: true; row: WeeklyHourRow } | { ok: false; error: string } {
  if (!Number.isInteger(row.weekday) || row.weekday < 1 || row.weekday > 7) {
    return { ok: false, error: "weekday must be 1–7 (Mon–Sun)" };
  }
  const open = row.openTime?.trim() || null;
  const close = row.closeTime?.trim() || null;
  if (open === null && close === null) {
    return { ok: true, row: { weekday: row.weekday, openTime: null, closeTime: null } };
  }
  if (open === null || close === null) {
    return {
      ok: false,
      error: `${WEEKDAY_LABELS[row.weekday]}: set both open and close, or leave both empty to close`,
    };
  }
  const t0 = parseHHMM(open);
  const t1 = parseHHMM(close);
  if (t0 === null || t1 === null) {
    return {
      ok: false,
      error: `${WEEKDAY_LABELS[row.weekday]}: times must be HH:mm`,
    };
  }
  if (t1 <= t0) {
    return {
      ok: false,
      error: `${WEEKDAY_LABELS[row.weekday]}: close must be after open (same-day only; overnight TODO)`,
    };
  }
  return {
    ok: true,
    row: {
      weekday: row.weekday,
      openTime: formatMinutes(t0),
      closeTime: formatMinutes(t1),
    },
  };
}

export function validateWeekly(
  weekly: WeeklyHourRow[]
): { ok: true; weekly: WeeklyHourRow[] } | { ok: false; error: string } {
  if (!Array.isArray(weekly) || weekly.length === 0) {
    return { ok: false, error: "weekly must include all 7 weekdays" };
  }
  const byDay = new Map<number, WeeklyHourRow>();
  for (const raw of weekly) {
    const v = validateHourRow(raw);
    if (!v.ok) return v;
    if (byDay.has(v.row.weekday)) {
      return { ok: false, error: `Duplicate weekday ${v.row.weekday}` };
    }
    byDay.set(v.row.weekday, v.row);
  }
  const out: WeeklyHourRow[] = [];
  for (const d of ALL_WEEKDAYS) {
    out.push(byDay.get(d) || { weekday: d, openTime: null, closeTime: null });
  }
  return { ok: true, weekly: out };
}

function instantFromYmdMinutes(
  ymd: string,
  minutes: number,
  timeZone: string
): Date {
  const h = Math.floor(minutes / 60);
  const mi = minutes % 60;
  const hhmm = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  return fromZonedTime(`${ymd} ${hhmm}:00`, timeZone);
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function dayWindow(
  row: WeeklyHourRow | undefined
): { openMin: number; closeMin: number } | null {
  if (!row?.openTime || !row?.closeTime) return null;
  const openMin = parseHHMM(row.openTime);
  const closeMin = parseHHMM(row.closeTime);
  if (openMin === null || closeMin === null || closeMin <= openMin) return null;
  return { openMin, closeMin };
}

export function evaluateOpenState(opts: {
  timezone: string;
  weekly: WeeklyHourRow[];
  /** No rows configured → always open. */
  alwaysOpen: boolean;
  forceLiveUntil: Date | null;
  now?: Date;
}): {
  isOpenNow: boolean;
  reason: OpenHoursPayload["reason"];
  forceLiveActive: boolean;
  nextOpenAt: string | null;
  nextCloseAt: string | null;
} {
  const now = opts.now ?? new Date();
  const forceLiveActive = !!(
    opts.forceLiveUntil && opts.forceLiveUntil.getTime() > now.getTime()
  );

  if (opts.alwaysOpen) {
    return {
      isOpenNow: true,
      reason: "always_open",
      forceLiveActive,
      nextOpenAt: null,
      nextCloseAt: null,
    };
  }

  if (forceLiveActive) {
    const next = findNextTransition(opts.weekly, opts.timezone, now);
    return {
      isOpenNow: true,
      reason: "force_live",
      forceLiveActive: true,
      nextOpenAt: next.nextOpenAt,
      nextCloseAt: opts.forceLiveUntil!.toISOString(),
    };
  }

  const parts = zonedParts(now, opts.timezone);
  const byDay = new Map(opts.weekly.map((r) => [r.weekday, r]));
  const win = dayWindow(byDay.get(parts.isoWeekday));

  if (!win) {
    const next = findNextTransition(opts.weekly, opts.timezone, now);
    return {
      isOpenNow: false,
      reason: "closed_day",
      forceLiveActive: false,
      nextOpenAt: next.nextOpenAt,
      nextCloseAt: null,
    };
  }

  if (parts.minutes >= win.openMin && parts.minutes < win.closeMin) {
    const closeAt = instantFromYmdMinutes(
      parts.ymd,
      win.closeMin,
      opts.timezone
    );
    return {
      isOpenNow: true,
      reason: "within_hours",
      forceLiveActive: false,
      nextOpenAt: null,
      nextCloseAt: closeAt.toISOString(),
    };
  }

  const next = findNextTransition(opts.weekly, opts.timezone, now);
  return {
    isOpenNow: false,
    reason: "outside_hours",
    forceLiveActive: false,
    nextOpenAt: next.nextOpenAt,
    nextCloseAt: null,
  };
}

/** Scan up to 8 days ahead for next open / close instants. */
function findNextTransition(
  weekly: WeeklyHourRow[],
  timeZone: string,
  now: Date
): { nextOpenAt: string | null; nextCloseAt: string | null } {
  const byDay = new Map(weekly.map((r) => [r.weekday, r]));
  const parts = zonedParts(now, timeZone);
  let nextOpenAt: string | null = null;
  let nextCloseAt: string | null = null;

  for (let offset = 0; offset < 8; offset++) {
    const ymd = addDaysYmd(parts.ymd, offset);
    // weekday of that ymd in zone: approximate via noon UTC of that date shifted
    const probe = instantFromYmdMinutes(ymd, 12 * 60, timeZone);
    const probeParts = zonedParts(probe, timeZone);
    const win = dayWindow(byDay.get(probeParts.isoWeekday));
    if (!win) continue;

    const openAt = instantFromYmdMinutes(ymd, win.openMin, timeZone);
    const closeAt = instantFromYmdMinutes(ymd, win.closeMin, timeZone);

    if (!nextOpenAt && openAt.getTime() > now.getTime()) {
      nextOpenAt = openAt.toISOString();
    }
    if (!nextCloseAt && closeAt.getTime() > now.getTime()) {
      // only meaningful if currently inside or about to open same day
      if (openAt.getTime() <= now.getTime() && closeAt.getTime() > now.getTime()) {
        nextCloseAt = closeAt.toISOString();
      }
    }
    if (nextOpenAt && (nextCloseAt || offset > 0)) break;
  }

  return { nextOpenAt, nextCloseAt };
}

export async function loadWeeklyForTarget(
  scope: OpenHoursScope,
  targetId: string
): Promise<{ weekly: WeeklyHourRow[]; rowCount: number }> {
  const rows = await prisma.openHours.findMany({
    where: { scope, targetId },
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

export async function replaceWeeklyHours(
  scope: OpenHoursScope,
  targetId: string,
  weekly: WeeklyHourRow[]
) {
  const validated = validateWeekly(weekly);
  if (!validated.ok) throw new Error(validated.error);

  await prisma.$transaction(async (tx) => {
    await tx.openHours.deleteMany({ where: { scope, targetId } });
    // Persist all 7 days so "configured" is unambiguous (alwaysOpen = false after save)
    await tx.openHours.createMany({
      data: validated.weekly.map((r) => ({
        scope,
        targetId,
        weekday: r.weekday,
        openTime: r.openTime,
        closeTime: r.closeTime,
      })),
    });
  });

  return validated.weekly;
}

export async function clearWeeklyHours(
  scope: OpenHoursScope,
  targetId: string
) {
  await prisma.openHours.deleteMany({ where: { scope, targetId } });
}

export async function resolveOpenHoursForScreen(
  screenId: string,
  now = new Date()
): Promise<OpenHoursPayload> {
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: {
      id: true,
      useCustomHours: true,
      forceLiveUntil: true,
      host: { select: { id: true, timezone: true } },
    },
  });
  if (!screen) {
    return {
      timezone: DEFAULT_TIMEZONE,
      source: "none",
      useCustomHours: false,
      weekly: emptyWeekly(),
      alwaysOpen: true,
      forceLiveUntil: null,
      forceLiveActive: false,
      isOpenNow: true,
      reason: "always_open",
      nextOpenAt: null,
      nextCloseAt: null,
      blackoutMode: BLACKOUT_MODE,
    };
  }

  const tz = screen.host.timezone || DEFAULT_TIMEZONE;
  let source: OpenHoursPayload["source"] = "host";
  let weekly: WeeklyHourRow[];
  let rowCount: number;

  if (screen.useCustomHours) {
    const loaded = await loadWeeklyForTarget("SCREEN", screen.id);
    weekly = loaded.weekly;
    rowCount = loaded.rowCount;
    source = "screen";
  } else {
    const loaded = await loadWeeklyForTarget("HOST", screen.host.id);
    weekly = loaded.weekly;
    rowCount = loaded.rowCount;
    source = rowCount > 0 ? "host" : "none";
  }

  const alwaysOpen = rowCount === 0;
  const evaled = evaluateOpenState({
    timezone: tz,
    weekly,
    alwaysOpen,
    forceLiveUntil: screen.forceLiveUntil,
    now,
  });

  return {
    timezone: tz,
    source,
    useCustomHours: screen.useCustomHours,
    weekly,
    alwaysOpen,
    forceLiveUntil: screen.forceLiveUntil?.toISOString() ?? null,
    forceLiveActive: evaled.forceLiveActive,
    isOpenNow: evaled.isOpenNow,
    reason: evaled.reason,
    nextOpenAt: evaled.nextOpenAt,
    nextCloseAt: evaled.nextCloseAt,
    blackoutMode: BLACKOUT_MODE,
  };
}

/**
 * Derive admin-facing device display status.
 * Priority: unpaired → offline → blackout (closed) → player-reported → idle.
 */
export function deriveDeviceDisplayStatus(opts: {
  hasDevice: boolean;
  online: boolean;
  hours: Pick<OpenHoursPayload, "isOpenNow" | "alwaysOpen" | "forceLiveActive">;
  playbackState?: string | null;
}): DeviceDisplayStatus {
  if (!opts.hasDevice) return "UNPAIRED";
  if (!opts.online) return "OFFLINE";
  if (!opts.hours.isOpenNow) return "BLACKOUT";
  const ps = (opts.playbackState || "").toUpperCase();
  if (ps === "LIVE") return "LIVE";
  if (ps === "EMPTY") return "EMPTY";
  if (ps === "IDLE") return "IDLE";
  if (ps === "BLACKOUT") return "BLACKOUT";
  return "IDLE";
}

export function formatHoursSummary(weekly: WeeklyHourRow[]): string {
  const openDays = weekly.filter((r) => r.openTime && r.closeTime);
  if (openDays.length === 0) return "Closed all week (or not configured)";
  // Group consecutive identical windows
  const parts: string[] = [];
  let i = 0;
  while (i < openDays.length) {
    const start = openDays[i];
    let j = i;
    while (
      j + 1 < openDays.length &&
      openDays[j + 1].weekday === openDays[j].weekday + 1 &&
      openDays[j + 1].openTime === start.openTime &&
      openDays[j + 1].closeTime === start.closeTime
    ) {
      j++;
    }
    const end = openDays[j];
    const label =
      start.weekday === end.weekday
        ? WEEKDAY_LABELS[start.weekday]
        : `${WEEKDAY_LABELS[start.weekday]}–${WEEKDAY_LABELS[end.weekday]}`;
    parts.push(`${label} ${start.openTime}–${start.closeTime}`);
    i = j + 1;
  }
  return parts.join(" · ");
}

/** Convenience Mon–Fri 09:00–17:00 preset. */
export function presetWeekdayBusiness(): WeeklyHourRow[] {
  return ALL_WEEKDAYS.map((weekday) =>
    weekday >= 1 && weekday <= 5
      ? { weekday, openTime: "09:00", closeTime: "17:00" }
      : { weekday, openTime: null, closeTime: null }
  );
}
