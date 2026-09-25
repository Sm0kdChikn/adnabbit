/**
 * Ticket E2 — expand Schedule rows into visible calendar blocks in host TZ.
 * Uses date-fns-tz (not bare Date local math). No ScheduleInstance rows.
 */
import { addDays, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  DEFAULT_TIMEZONE,
  parseHHMM,
  parseWeekdaysCsv,
  ymdCompare,
} from "./schedules";

export type CalendarScheduleInput = {
  id: string;
  kind: string;
  status: string;
  screenId: string;
  startAt: Date | string | null;
  endAt: Date | string | null;
  weekdays: string | null;
  startTime: string | null;
  endTime: string | null;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
  note?: string | null;
  screen: {
    name: string;
    host: { name: string; timezone: string | null };
  };
  placement: {
    creative: { name: string };
    advertiser?: { name?: string | null; email?: string };
  };
};

export type CalendarBlock = {
  key: string;
  scheduleId: string;
  dayYmd: string;
  startMinutes: number;
  endMinutes: number;
  status: string;
  kind: string;
  title: string;
  subtitle: string;
  timeZone: string;
  hostName: string;
  screenName: string;
  creativeName: string;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function addYmd(ymd: string, days: number): string {
  const base = parseISO(`${ymd}T12:00:00`);
  return formatInTimeZone(addDays(base, days), "UTC", "yyyy-MM-dd");
}

export function eachYmdInclusive(startYmd: string, endYmd: string): string[] {
  if (!YMD_RE.test(startYmd) || !YMD_RE.test(endYmd)) return [];
  if (ymdCompare(startYmd, endYmd) > 0) return [];
  const out: string[] = [];
  let cur = startYmd;
  while (ymdCompare(cur, endYmd) <= 0) {
    out.push(cur);
    cur = addYmd(cur, 1);
  }
  return out;
}

/** ISO weekday Mon=1 .. Sun=7 for a calendar YMD (date-only). */
export function isoWeekdayFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const js = dt.getUTCDay();
  return js === 0 ? 7 : js;
}

export function formatMinutesLabel(mins: number): string {
  if (mins >= 24 * 60) return "24:00";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Monday (ISO) of the week containing ymd. */
export function startOfWeekYmd(ymd: string): string {
  const wd = isoWeekdayFromYmd(ymd);
  return addYmd(ymd, -(wd - 1));
}

export function startOfMonthYmd(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function endOfMonthYmd(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** Month grid: Mon-start weeks covering the month (may include adjacent days). */
export function monthGridRange(anchorYmd: string): {
  start: string;
  end: string;
  days: string[];
} {
  const first = startOfMonthYmd(anchorYmd);
  const last = endOfMonthYmd(anchorYmd);
  const start = startOfWeekYmd(first);
  const endWeekStart = startOfWeekYmd(last);
  const end = addYmd(endWeekStart, 6);
  return { start, end, days: eachYmdInclusive(start, end) };
}

export function weekRange(anchorYmd: string): {
  start: string;
  end: string;
  days: string[];
} {
  const start = startOfWeekYmd(anchorYmd);
  const end = addYmd(start, 6);
  return { start, end, days: eachYmdInclusive(start, end) };
}

function asDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function zonedYmdMinutes(
  instant: Date,
  timeZone: string
): { ymd: string; minutes: number } {
  const ymd = formatInTimeZone(instant, timeZone, "yyyy-MM-dd");
  const hm = formatInTimeZone(instant, timeZone, "HH:mm");
  const [h, m] = hm.split(":").map(Number);
  return { ymd, minutes: h * 60 + m };
}

function blockTitle(s: CalendarScheduleInput): string {
  return s.placement.creative.name;
}

function blockSubtitle(s: CalendarScheduleInput): string {
  return `${s.screen.host.name} · ${s.screen.name}`;
}

/**
 * Expand ONE_OFF into per-day segments in host TZ for [rangeStart, rangeEnd] inclusive.
 * End exactly at midnight → previous day ends at 24:00.
 */
function expandOneOff(
  s: CalendarScheduleInput,
  rangeStart: string,
  rangeEnd: string,
  timeZone: string
): CalendarBlock[] {
  if (!s.startAt || !s.endAt) return [];
  const startAt = asDate(s.startAt);
  const endAt = asDate(s.endAt);
  if (!(endAt > startAt)) return [];

  const a = zonedYmdMinutes(startAt, timeZone);
  const b = zonedYmdMinutes(endAt, timeZone);

  let lastYmd = b.ymd;
  let lastEndMins = b.minutes;
  if (b.minutes === 0 && endAt.getTime() > startAt.getTime()) {
    lastYmd = addYmd(b.ymd, -1);
    lastEndMins = 24 * 60;
  }
  if (ymdCompare(a.ymd, lastYmd) > 0) return [];

  const from = ymdCompare(a.ymd, rangeStart) > 0 ? a.ymd : rangeStart;
  const to = ymdCompare(lastYmd, rangeEnd) < 0 ? lastYmd : rangeEnd;
  if (ymdCompare(from, to) > 0) return [];

  const blocks: CalendarBlock[] = [];
  for (const day of eachYmdInclusive(from, to)) {
    let startMinutes = 0;
    let endMinutes = 24 * 60;
    if (day === a.ymd) startMinutes = a.minutes;
    if (day === lastYmd) endMinutes = lastEndMins;
    if (endMinutes <= startMinutes) continue;
    blocks.push({
      key: `${s.id}:${day}`,
      scheduleId: s.id,
      dayYmd: day,
      startMinutes,
      endMinutes,
      status: s.status,
      kind: s.kind,
      title: blockTitle(s),
      subtitle: blockSubtitle(s),
      timeZone,
      hostName: s.screen.host.name,
      screenName: s.screen.name,
      creativeName: s.placement.creative.name,
    });
  }
  return blocks;
}

/**
 * Expand RECURRING dayparts for days in range ∩ campaign that match weekdays.
 * Overnight (endTime < startTime): weekday applies to start day D — emit
 * start→24:00 on D and 00:00→end on D+1, clipped to the calendar range.
 * Equal times (zero-length) are skipped.
 */
function expandRecurring(
  s: CalendarScheduleInput,
  rangeStart: string,
  rangeEnd: string,
  timeZone: string
): CalendarBlock[] {
  if (
    !s.campaignStartDate ||
    !s.campaignEndDate ||
    !s.weekdays ||
    !s.startTime ||
    !s.endTime
  ) {
    return [];
  }
  const daysList = parseWeekdaysCsv(s.weekdays);
  const t0 = parseHHMM(s.startTime);
  const t1 = parseHHMM(s.endTime);
  if (!daysList || t0 === null || t1 === null || t0 === t1) return [];

  const overnight = t1 < t0;
  const weekdaySet = new Set(daysList);
  const blocks: CalendarBlock[] = [];

  // Start days: campaign ∩ range (for same-day) or campaign (overnight may spill D+1 into range).
  const startFrom =
    ymdCompare(s.campaignStartDate, rangeStart) > 0
      ? s.campaignStartDate
      : rangeStart;
  // For overnight, also consider start days one before rangeStart (D+1 may land in range).
  const startScanFrom = overnight
    ? (ymdCompare(s.campaignStartDate, addYmd(rangeStart, -1)) > 0
        ? s.campaignStartDate
        : addYmd(rangeStart, -1))
    : startFrom;
  const startScanTo = s.campaignEndDate;
  if (ymdCompare(startScanFrom, startScanTo) > 0) return [];

  const pushBlock = (
    day: string,
    startMinutes: number,
    endMinutes: number,
    suffix: string
  ) => {
    if (ymdCompare(day, rangeStart) < 0 || ymdCompare(day, rangeEnd) > 0) return;
    if (endMinutes <= startMinutes) return;
    blocks.push({
      key: `${s.id}:${day}:${suffix}`,
      scheduleId: s.id,
      dayYmd: day,
      startMinutes,
      endMinutes,
      status: s.status,
      kind: s.kind,
      title: blockTitle(s),
      subtitle: blockSubtitle(s),
      timeZone,
      hostName: s.screen.host.name,
      screenName: s.screen.name,
      creativeName: s.placement.creative.name,
    });
  };

  for (const day of eachYmdInclusive(startScanFrom, startScanTo)) {
    if (!weekdaySet.has(isoWeekdayFromYmd(day))) continue;
    // Start day must be within campaign (always true here) and for non-overnight also in range.
    if (!overnight) {
      if (ymdCompare(day, rangeStart) < 0 || ymdCompare(day, rangeEnd) > 0) continue;
      pushBlock(day, t0, t1, "same");
      continue;
    }
    // Overnight: D evening + D+1 morning, clip each to calendar range.
    pushBlock(day, t0, 24 * 60, "eve");
    pushBlock(addYmd(day, 1), 0, t1, "morn");
  }
  return blocks;
}

export function expandSchedulesToBlocks(
  schedules: CalendarScheduleInput[],
  rangeStart: string,
  rangeEnd: string
): CalendarBlock[] {
  const out: CalendarBlock[] = [];
  for (const s of schedules) {
    const tz = s.screen.host.timezone || DEFAULT_TIMEZONE;
    if (s.kind === "RECURRING") {
      out.push(...expandRecurring(s, rangeStart, rangeEnd, tz));
    } else {
      out.push(...expandOneOff(s, rangeStart, rangeEnd, tz));
    }
  }
  out.sort((a, b) => {
    const c = ymdCompare(a.dayYmd, b.dayYmd);
    if (c !== 0) return c;
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return a.title.localeCompare(b.title);
  });
  return out;
}

/** Today as YMD in an IANA zone (date-fns-tz). */
export function todayYmd(
  timeZone: string = DEFAULT_TIMEZONE,
  now = new Date()
): string {
  return formatInTimeZone(now, timeZone, "yyyy-MM-dd");
}

/** Build Instant from host-local YMD + HH:mm (for tests / future). */
export function instantFromHostLocal(
  ymd: string,
  hhmm: string,
  timeZone: string
): Date {
  return fromZonedTime(`${ymd} ${hhmm}:00`, timeZone);
}
