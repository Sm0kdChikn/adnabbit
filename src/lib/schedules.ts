import { prisma } from "./prisma";

export const DEFAULT_TIMEZONE = "America/Denver";

/** Overlap: [startA, endA) intersects [startB, endB) */
export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA < endB && startB < endA;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function parseHHMM(value: string): number | null {
  const m = HHMM.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** ISO weekday Mon=1 .. Sun=7 */
export function parseWeekdaysCsv(csv: string): number[] | null {
  const parts = csv
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const days: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1 || n > 7) return null;
    if (!days.includes(n)) days.push(n);
  }
  days.sort((a, b) => a - b);
  return days;
}

export function weekdaysToCsv(days: number[]): string {
  return Array.from(new Set(days)).sort((a, b) => a - b).join(",");
}

export function isValidYmd(value: string): boolean {
  if (!YMD.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

export function ymdCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Local calendar parts for an Instant in an IANA zone. */
export function zonedParts(
  date: Date,
  timeZone: string
): { ymd: string; minutes: number; isoWeekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const y = get("year");
  const mo = get("month");
  const d = get("day");
  const h = Number(get("hour"));
  const mi = Number(get("minute"));
  const wd = get("weekday");
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return {
    ymd: `${y}-${mo}-${d}`,
    minutes: h * 60 + mi,
    isoWeekday: map[wd] || 1,
  };
}

export function todayYmdInZone(timeZone: string, now = new Date()): string {
  return zonedParts(now, timeZone).ymd;
}

/** ISO weekdays present in [startYmd, endYmd] inclusive (span ≥ 7 → all). */
export function weekdaysInYmdRange(startYmd: string, endYmd: string): Set<number> {
  if (ymdCompare(startYmd, endYmd) > 0) return new Set();
  const start = new Date(`${startYmd}T00:00:00Z`);
  const end = new Date(`${endYmd}T00:00:00Z`);
  const days =
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days >= 7) return new Set([1, 2, 3, 4, 5, 6, 7]);
  const out = new Set<number>();
  for (let i = 0; i < days; i++) {
    const dt = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const js = dt.getUTCDay();
    out.add(js === 0 ? 7 : js);
  }
  return out;
}

export type ScheduleOverlapShape = {
  id?: string;
  kind: string;
  startAt: Date | null;
  endAt: Date | null;
  weekdays: string | null;
  startTime: string | null;
  endTime: string | null;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
};

export type NormalizedInterval = {
  dateStart: string;
  dateEnd: string;
  weekdays: Set<number>;
  timeStart: number;
  timeEnd: number;
};

/**
 * Normalize schedule → date/weekday/time in host TZ.
 * ONE_OFF multi-day → full-day (0–1440) for conservative daypart overlap.
 * No overnight RECURRING; no instance expansion.
 */
export function normalizeScheduleInterval(
  s: ScheduleOverlapShape,
  timeZone: string
): NormalizedInterval | null {
  if (s.kind === "RECURRING") {
    if (
      !s.campaignStartDate ||
      !s.campaignEndDate ||
      !s.weekdays ||
      !s.startTime ||
      !s.endTime
    ) {
      return null;
    }
    const days = parseWeekdaysCsv(s.weekdays);
    const t0 = parseHHMM(s.startTime);
    const t1 = parseHHMM(s.endTime);
    if (!days || t0 === null || t1 === null || t1 <= t0) return null;
    return {
      dateStart: s.campaignStartDate,
      dateEnd: s.campaignEndDate,
      weekdays: new Set(days),
      timeStart: t0,
      timeEnd: t1,
    };
  }

  if (!s.startAt || !s.endAt) return null;
  const a = zonedParts(s.startAt, timeZone);
  const b = zonedParts(s.endAt, timeZone);
  let dateEnd = b.ymd;
  let timeEnd = b.minutes;
  if (b.minutes === 0 && s.endAt.getTime() > s.startAt.getTime() && b.ymd !== a.ymd) {
    const prev = new Date(`${b.ymd}T00:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    dateEnd = prev.toISOString().slice(0, 10);
    timeEnd = 24 * 60;
  }
  if (ymdCompare(a.ymd, dateEnd) > 0) return null;

  const sameDay = a.ymd === dateEnd;
  return {
    dateStart: a.ymd,
    dateEnd,
    weekdays: weekdaysInYmdRange(a.ymd, dateEnd),
    timeStart: sameDay ? a.minutes : 0,
    timeEnd: sameDay ? (timeEnd === 0 ? 24 * 60 : timeEnd) : 24 * 60,
  };
}

export function intervalsOverlap(a: NormalizedInterval, b: NormalizedInterval): boolean {
  if (ymdCompare(a.dateStart, b.dateEnd) > 0 || ymdCompare(b.dateStart, a.dateEnd) > 0) {
    return false;
  }
  let weekdayHit = false;
  for (const d of Array.from(a.weekdays)) {
    if (b.weekdays.has(d)) {
      weekdayHit = true;
      break;
    }
  }
  if (!weekdayHit) return false;
  return a.timeStart < b.timeEnd && b.timeStart < a.timeEnd;
}

/** ACTIVE → ENDED when ONE_OFF endAt passed or RECURRING campaignEndDate < today (host TZ). */
export async function materializeEndedSchedules(ids?: string[]) {
  const now = new Date();
  const where = {
    status: "ACTIVE" as const,
    ...(ids && ids.length ? { id: { in: ids } } : {}),
  };
  const active = await prisma.schedule.findMany({
    where,
    select: {
      id: true,
      kind: true,
      endAt: true,
      campaignEndDate: true,
      screen: { select: { host: { select: { timezone: true } } } },
    },
  });

  const toEnd: string[] = [];
  for (const s of active) {
    const tz = s.screen.host.timezone || DEFAULT_TIMEZONE;
    if (s.kind === "RECURRING") {
      if (
        s.campaignEndDate &&
        ymdCompare(s.campaignEndDate, todayYmdInZone(tz, now)) < 0
      ) {
        toEnd.push(s.id);
      }
    } else if (s.endAt && s.endAt < now) {
      toEnd.push(s.id);
    }
  }

  if (toEnd.length === 0) return 0;
  const result = await prisma.schedule.updateMany({
    where: { id: { in: toEnd }, status: "ACTIVE" },
    data: { status: "ENDED" },
  });
  return result.count;
}

/** Warn-first: ACTIVE overlaps on same screen (cross-kind, host TZ). */
export async function findOverlappingActiveSchedules(opts: {
  screenId: string;
  candidate: ScheduleOverlapShape;
  excludeId?: string;
}) {
  const screen = await prisma.screen.findUnique({
    where: { id: opts.screenId },
    select: { host: { select: { timezone: true } } },
  });
  const tz = screen?.host.timezone || DEFAULT_TIMEZONE;
  const candidateNorm = normalizeScheduleInterval(opts.candidate, tz);
  if (!candidateNorm) return [];

  const candidates = await prisma.schedule.findMany({
    where: {
      screenId: opts.screenId,
      status: "ACTIVE",
      ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
    },
    select: {
      id: true,
      kind: true,
      startAt: true,
      endAt: true,
      weekdays: true,
      startTime: true,
      endTime: true,
      campaignStartDate: true,
      campaignEndDate: true,
      status: true,
      placementId: true,
      note: true,
    },
  });

  return candidates.filter((c) => {
    const norm = normalizeScheduleInterval(c, tz);
    if (!norm) return false;
    return intervalsOverlap(candidateNorm, norm);
  });
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export function formatScheduleSummary(
  s: {
    kind: string;
    startAt: Date | null;
    endAt: Date | null;
    weekdays: string | null;
    startTime: string | null;
    endTime: string | null;
    campaignStartDate: string | null;
    campaignEndDate: string | null;
  },
  timeZone?: string | null
): string {
  const tz = timeZone || DEFAULT_TIMEZONE;
  if (s.kind === "RECURRING") {
    const days = s.weekdays
      ? parseWeekdaysCsv(s.weekdays)
          ?.map((d) => WEEKDAY_LABELS[d] || String(d))
          .join(", ")
      : "?";
    return `RECURRING ${days} ${s.startTime}–${s.endTime} · ${s.campaignStartDate} → ${s.campaignEndDate} (${tz})`;
  }
  if (s.startAt && s.endAt) {
    return `ONE_OFF ${s.startAt.toLocaleString()} → ${s.endAt.toLocaleString()}`;
  }
  return "ONE_OFF (incomplete)";
}

export const scheduleInclude = {
  placement: {
    include: {
      advertiser: { select: { id: true, email: true, name: true } },
      creative: {
        select: {
          id: true,
          name: true,
          status: true,
          fileName: true,
          storedName: true,
          mimeType: true,
        },
      },
      screen: {
        include: {
          host: {
            select: {
              id: true,
              name: true,
              vertical: true,
              otherLabel: true,
              timezone: true,
            },
          },
        },
      },
    },
  },
  screen: {
    include: {
      host: {
        select: {
          id: true,
          name: true,
          vertical: true,
          otherLabel: true,
          timezone: true,
        },
      },
    },
  },
  createdBy: { select: { id: true, email: true, name: true } },
} as const;
