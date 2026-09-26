/**
 * Ticket T — schedule fill, daypart heat, campaign rollup analytics.
 * Truth sources: OpenHours + expandSchedulesToBlocks (same as playlist).
 * Does NOT invent play counts — Plays panel awaits F2 / OptiSigns PoP.
 */
import { formatInTimeZone } from "date-fns-tz";
import {
  addYmd,
  eachYmdInclusive,
  expandSchedulesToBlocks,
  isoWeekdayFromYmd,
  type CalendarScheduleInput,
} from "./calendar-expand";
import {
  loadWeeklyForTarget,
  type WeeklyHourRow,
} from "./open-hours";
import { prisma } from "./prisma";
import {
  DEFAULT_TIMEZONE,
  parseHHMM,
  todayYmdInZone,
  WEEKDAY_LABELS,
} from "./schedules";
import {
  scheduleWindowPhase,
  type WindowPhase,
} from "./take-down";

export const ANALYTICS_ROLES = ["ADMIN", "HOST", "ADVERTISER"] as const;
export type AnalyticsRole = (typeof ANALYTICS_ROLES)[number];

const DAY_MINUTES = 24 * 60;

export type AnalyticsScope = {
  role: AnalyticsRole;
  userId: string;
  /** Host.id when HOST */
  hostId?: string | null;
  /** Restrict screens (admin filter or host venue) */
  screenIds?: string[] | null;
  /** Restrict to advertiser's creatives/schedules */
  advertiserId?: string | null;
};

export type DateRange = {
  fromYmd: string;
  toYmd: string;
  preset: "7" | "30" | "custom";
};

export type AnalyticsFilters = {
  hostId?: string | null;
  screenId?: string | null;
  advertiserId?: string | null;
};

export type FillRow = {
  screenId: string;
  screenName: string;
  hostId: string;
  hostName: string;
  dayYmd: string;
  timezone: string;
  openMinutes: number;
  closedMinutes: number;
  paidMinutes: number;
  emptyWhileOpenMinutes: number;
  paidItems: number;
  fillPct: number | null;
  takenDown: boolean;
};

export type DaypartHeatCell = {
  weekday: number;
  hour: number;
  minutes: number;
};

export type DaypartHeatResult = {
  timezoneHint: string;
  cells: DaypartHeatCell[];
  /** 7×24 matrix [weekday 1-7][hour 0-23] */
  grid: number[][];
  totalMinutes: number;
};

export type CampaignRow = {
  scheduleId: string;
  kind: string;
  status: string;
  phase: WindowPhase;
  screenId: string;
  screenName: string;
  hostId: string;
  hostName: string;
  timezone: string;
  creativeId: string;
  creativeName: string;
  advertiserId: string;
  advertiserEmail: string;
  windowStart: string | null;
  windowEnd: string | null;
};

export type CampaignRollup = {
  counts: Record<WindowPhase, number>;
  rows: CampaignRow[];
};

function ymdRe(s: string | null | undefined): boolean {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Parse from/to/range query into inclusive YMD range in America/Denver (reporting TZ). */
export function parseAnalyticsDateRange(
  params: { from?: string | null; to?: string | null; range?: string | null },
  now = new Date()
): DateRange {
  const reportingTz = DEFAULT_TIMEZONE;
  const today = todayYmdInZone(reportingTz, now);
  const rangeRaw = (params.range || "").trim();

  if (rangeRaw === "30") {
    return { fromYmd: addYmd(today, -29), toYmd: today, preset: "30" };
  }
  if (rangeRaw === "7" || (!params.from && !params.to && !rangeRaw)) {
    return { fromYmd: addYmd(today, -6), toYmd: today, preset: "7" };
  }

  let fromYmd = ymdRe(params.from) ? params.from!.trim() : addYmd(today, -6);
  let toYmd = ymdRe(params.to) ? params.to!.trim() : today;
  if (fromYmd > toYmd) {
    const t = fromYmd;
    fromYmd = toYmd;
    toYmd = t;
  }
  // Cap span at 90 days for MVP safety
  const days = eachYmdInclusive(fromYmd, toYmd);
  if (days.length > 90) {
    fromYmd = addYmd(toYmd, -89);
  }
  return { fromYmd, toYmd, preset: "custom" };
}

export function parseAnalyticsFilters(params: {
  hostId?: string | null;
  screenId?: string | null;
  advertiserId?: string | null;
}): AnalyticsFilters {
  return {
    hostId: params.hostId?.trim() || null,
    screenId: params.screenId?.trim() || null,
    advertiserId: params.advertiserId?.trim() || null,
  };
}

/** Union length of half-open [start,end) minute intervals. */
export function unionIntervalMinutes(
  intervals: { start: number; end: number }[]
): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals]
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (sorted.length === 0) return 0;
  let total = 0;
  let curS = sorted[0].start;
  let curE = sorted[0].end;
  for (let i = 1; i < sorted.length; i++) {
    const iv = sorted[i];
    if (iv.start <= curE) {
      curE = Math.max(curE, iv.end);
    } else {
      total += curE - curS;
      curS = iv.start;
      curE = iv.end;
    }
  }
  total += curE - curS;
  return total;
}

function dayOpenWindow(
  weekly: WeeklyHourRow[],
  alwaysOpen: boolean,
  weekday: number
): { openMin: number; closeMin: number } | null {
  if (alwaysOpen) return { openMin: 0, closeMin: DAY_MINUTES };
  const row = weekly.find((r) => r.weekday === weekday);
  if (!row?.openTime || !row?.closeTime) return null;
  const openMin = parseHHMM(row.openTime);
  const closeMin = parseHHMM(row.closeTime);
  if (openMin === null || closeMin === null || closeMin <= openMin) return null;
  return { openMin, closeMin };
}

type ScreenCtx = {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  timezone: string;
  useCustomHours: boolean;
  playbackTakenDownAt: Date | null;
  hostPlaybackTakenDownAt: Date | null;
  weekly: WeeklyHourRow[];
  alwaysOpen: boolean;
};

async function loadScopedScreens(
  scope: AnalyticsScope,
  filters: AnalyticsFilters
): Promise<ScreenCtx[]> {
  const where: {
    id?: string | { in: string[] };
    hostId?: string;
  } = {};

  if (scope.role === "HOST") {
    if (!scope.hostId) return [];
    where.hostId = scope.hostId;
  } else if (filters.hostId) {
    where.hostId = filters.hostId;
  }

  if (scope.screenIds?.length) {
    where.id = { in: scope.screenIds };
  }
  if (filters.screenId) {
    where.id = filters.screenId;
  }

  // Advertiser: screens with any of their schedules/placements (approved)
  if (scope.role === "ADVERTISER" && scope.advertiserId) {
    const placed = await prisma.schedule.findMany({
      where: {
        placement: { advertiserId: scope.advertiserId },
        ...(filters.screenId ? { screenId: filters.screenId } : {}),
      },
      select: { screenId: true },
      distinct: ["screenId"],
    });
    const ids = placed.map((p) => p.screenId);
    if (ids.length === 0) return [];
    if (filters.screenId && !ids.includes(filters.screenId)) return [];
    where.id = filters.screenId ? filters.screenId : { in: ids };
  }

  const screens = await prisma.screen.findMany({
    where,
    include: {
      host: {
        select: {
          id: true,
          name: true,
          timezone: true,
          playbackTakenDownAt: true,
        },
      },
    },
    orderBy: [{ host: { name: "asc" } }, { name: "asc" }],
  });

  const out: ScreenCtx[] = [];
  for (const s of screens) {
    let weekly: WeeklyHourRow[];
    let rowCount: number;
    if (s.useCustomHours) {
      const loaded = await loadWeeklyForTarget("SCREEN", s.id);
      weekly = loaded.weekly;
      rowCount = loaded.rowCount;
    } else {
      const loaded = await loadWeeklyForTarget("HOST", s.host.id);
      weekly = loaded.weekly;
      rowCount = loaded.rowCount;
    }
    out.push({
      id: s.id,
      name: s.name,
      hostId: s.host.id,
      hostName: s.host.name,
      timezone: s.host.timezone || DEFAULT_TIMEZONE,
      useCustomHours: s.useCustomHours,
      playbackTakenDownAt: s.playbackTakenDownAt,
      hostPlaybackTakenDownAt: s.host.playbackTakenDownAt,
      weekly,
      alwaysOpen: rowCount === 0,
    });
  }
  return out;
}

type SchedRow = {
  id: string;
  kind: string;
  status: string;
  screenId: string;
  startAt: Date | null;
  endAt: Date | null;
  weekdays: string | null;
  startTime: string | null;
  endTime: string | null;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
  note: string | null;
  creativeId: string;
  creativeName: string;
  creativeStatus: string;
  creativeTakenDownAt: Date | null;
  advertiserId: string;
  advertiserEmail: string;
  advertiserName: string | null;
  advertiserTakenDownAt: Date | null;
  screenName: string;
  hostId: string;
  hostName: string;
  timezone: string;
  hostTakenDownAt: Date | null;
  screenTakenDownAt: Date | null;
};

async function loadActiveSchedulesForScreens(
  screenIds: string[],
  scope: AnalyticsScope,
  filters: AnalyticsFilters
): Promise<SchedRow[]> {
  if (screenIds.length === 0) return [];

  const advertiserFilter =
    scope.role === "ADVERTISER"
      ? scope.advertiserId
      : filters.advertiserId || null;

  const rows = await prisma.schedule.findMany({
    where: {
      screenId: { in: screenIds },
      status: "ACTIVE",
      ...(advertiserFilter
        ? { placement: { advertiserId: advertiserFilter } }
        : {}),
    },
    include: {
      placement: {
        include: {
          creative: {
            select: {
              id: true,
              name: true,
              status: true,
              takenDownAt: true,
            },
          },
          advertiser: {
            select: {
              id: true,
              email: true,
              name: true,
              advertiserTakenDownAt: true,
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
              timezone: true,
              playbackTakenDownAt: true,
            },
          },
        },
      },
    },
  });

  return rows.map((s) => ({
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
    creativeId: s.placement.creative.id,
    creativeName: s.placement.creative.name,
    creativeStatus: s.placement.creative.status,
    creativeTakenDownAt: s.placement.creative.takenDownAt,
    advertiserId: s.placement.advertiser.id,
    advertiserEmail: s.placement.advertiser.email,
    advertiserName: s.placement.advertiser.name,
    advertiserTakenDownAt: s.placement.advertiser.advertiserTakenDownAt,
    screenName: s.screen.name,
    hostId: s.screen.host.id,
    hostName: s.screen.host.name,
    timezone: s.screen.host.timezone || DEFAULT_TIMEZONE,
    hostTakenDownAt: s.screen.host.playbackTakenDownAt,
    screenTakenDownAt: s.screen.playbackTakenDownAt,
  }));
}

function toCalendarInput(s: SchedRow): CalendarScheduleInput | null {
  // Playlist truth: skip taken-down creative/advertiser; host/screen kill handled at fill
  if (s.creativeStatus !== "APPROVED") return null;
  if (s.creativeTakenDownAt) return null;
  if (s.advertiserTakenDownAt) return null;
  return {
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
      name: s.screenName,
      host: { name: s.hostName, timezone: s.timezone },
    },
    placement: {
      creative: { name: s.creativeName },
      advertiser: { name: s.advertiserName, email: s.advertiserEmail },
    },
  };
}

/**
 * Per screen/day fill from open hours + scheduled paid blocks (union minutes).
 * Soft miss: force-live overrides are not replayed historically — uses configured hours only.
 */
export async function computeFill(
  scope: AnalyticsScope,
  range: DateRange,
  filters: AnalyticsFilters = {}
): Promise<{ rows: FillRow[]; summary: FillSummary }> {
  const screens = await loadScopedScreens(scope, filters);
  const screenIds = screens.map((s) => s.id);
  const schedules = await loadActiveSchedulesForScreens(screenIds, scope, filters);
  const byScreen = new Map<string, SchedRow[]>();
  for (const s of schedules) {
    const list = byScreen.get(s.screenId) || [];
    list.push(s);
    byScreen.set(s.screenId, list);
  }

  const days = eachYmdInclusive(range.fromYmd, range.toYmd);
  const rows: FillRow[] = [];

  for (const screen of screens) {
    const scheds = byScreen.get(screen.id) || [];
    const inputs = scheds
      .map(toCalendarInput)
      .filter((x): x is CalendarScheduleInput => !!x);
    const takenDown = !!(
      screen.playbackTakenDownAt || screen.hostPlaybackTakenDownAt
    );
    const blocks = takenDown
      ? []
      : expandSchedulesToBlocks(inputs, range.fromYmd, range.toYmd);

    const blocksByDay = new Map<string, typeof blocks>();
    for (const b of blocks) {
      if (b.screenName && b.dayYmd) {
        /* blocks are for this screen's schedules only */
      }
      const list = blocksByDay.get(b.dayYmd) || [];
      list.push(b);
      blocksByDay.set(b.dayYmd, list);
    }

    for (const day of days) {
      const wd = isoWeekdayFromYmd(day);
      const win = dayOpenWindow(screen.weekly, screen.alwaysOpen, wd);
      const openMinutes = win ? win.closeMin - win.openMin : 0;
      const closedMinutes = DAY_MINUTES - openMinutes;

      let paidMinutes = 0;
      let paidItems = 0;
      if (win && !takenDown) {
        const dayBlocks = blocksByDay.get(day) || [];
        const clipped: { start: number; end: number }[] = [];
        for (const b of dayBlocks) {
          const start = Math.max(b.startMinutes, win.openMin);
          const end = Math.min(b.endMinutes, win.closeMin);
          if (end > start) {
            clipped.push({ start, end });
            paidItems += 1;
          }
        }
        paidMinutes = unionIntervalMinutes(clipped);
      }

      const emptyWhileOpenMinutes = Math.max(0, openMinutes - paidMinutes);
      const fillPct =
        openMinutes > 0
          ? Math.round((paidMinutes / openMinutes) * 1000) / 10
          : null;

      rows.push({
        screenId: screen.id,
        screenName: screen.name,
        hostId: screen.hostId,
        hostName: screen.hostName,
        dayYmd: day,
        timezone: screen.timezone,
        openMinutes,
        closedMinutes,
        paidMinutes,
        emptyWhileOpenMinutes,
        paidItems,
        fillPct,
        takenDown,
      });
    }
  }

  return { rows, summary: summarizeFill(rows) };
}

export type FillSummary = {
  screenDays: number;
  totalOpenMinutes: number;
  totalClosedMinutes: number;
  totalPaidMinutes: number;
  totalEmptyWhileOpenMinutes: number;
  totalPaidItems: number;
  avgFillPct: number | null;
};

function summarizeFill(rows: FillRow[]): FillSummary {
  let totalOpenMinutes = 0;
  let totalClosedMinutes = 0;
  let totalPaidMinutes = 0;
  let totalEmptyWhileOpenMinutes = 0;
  let totalPaidItems = 0;
  let fillWeighted = 0;
  let fillWeight = 0;
  for (const r of rows) {
    totalOpenMinutes += r.openMinutes;
    totalClosedMinutes += r.closedMinutes;
    totalPaidMinutes += r.paidMinutes;
    totalEmptyWhileOpenMinutes += r.emptyWhileOpenMinutes;
    totalPaidItems += r.paidItems;
    if (r.openMinutes > 0) {
      fillWeighted += r.paidMinutes;
      fillWeight += r.openMinutes;
    }
  }
  return {
    screenDays: rows.length,
    totalOpenMinutes,
    totalClosedMinutes,
    totalPaidMinutes,
    totalEmptyWhileOpenMinutes,
    totalPaidItems,
    avgFillPct:
      fillWeight > 0
        ? Math.round((fillWeighted / fillWeight) * 1000) / 10
        : null,
  };
}

/**
 * Weekday × hour grid of scheduled paid minutes (host TZ of each block).
 * Sums across days in range. Does not invent plays.
 */
export async function computeDaypartHeat(
  scope: AnalyticsScope,
  range: DateRange,
  filters: AnalyticsFilters = {}
): Promise<DaypartHeatResult> {
  const screens = await loadScopedScreens(scope, filters);
  const screenIds = screens.map((s) => s.id);
  const schedules = await loadActiveSchedulesForScreens(screenIds, scope, filters);

  const grid: number[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 24 }, () => 0)
  );
  // index 0 unused; weekdays 1-7

  let timezoneHint = DEFAULT_TIMEZONE;
  if (screens[0]) timezoneHint = screens[0].timezone;

  for (const s of schedules) {
    if (s.hostTakenDownAt || s.screenTakenDownAt) continue;
    const input = toCalendarInput(s);
    if (!input) continue;
    const blocks = expandSchedulesToBlocks(
      [input],
      range.fromYmd,
      range.toYmd
    );
    for (const b of blocks) {
      const wd = isoWeekdayFromYmd(b.dayYmd);
      let m = b.startMinutes;
      const end = b.endMinutes;
      while (m < end) {
        const hour = Math.min(23, Math.floor(m / 60));
        const hourEnd = Math.min(end, (hour + 1) * 60);
        const mins = hourEnd - m;
        if (mins > 0 && wd >= 1 && wd <= 7) {
          grid[wd][hour] += mins;
        }
        m = hourEnd;
      }
    }
  }

  const cells: DaypartHeatCell[] = [];
  let totalMinutes = 0;
  for (let wd = 1; wd <= 7; wd++) {
    for (let hour = 0; hour < 24; hour++) {
      const minutes = grid[wd][hour];
      if (minutes > 0) cells.push({ weekday: wd, hour, minutes });
      totalMinutes += minutes;
    }
  }

  return { timezoneHint, cells, grid, totalMinutes };
}

/** Campaign window rollup using scheduleWindowPhase (Ticket S). */
export async function computeCampaigns(
  scope: AnalyticsScope,
  filters: AnalyticsFilters = {},
  now = new Date()
): Promise<CampaignRollup> {
  const where: {
    screenId?: string | { in: string[] };
    screen?: { hostId?: string };
    placement?: { advertiserId?: string };
    status?: { notIn: string[] } | string;
  } = {
    // Include DRAFT/ACTIVE/ENDED/CANCELLED for rollup honesty
  };

  if (scope.role === "HOST" && scope.hostId) {
    where.screen = { hostId: scope.hostId };
  } else if (filters.hostId) {
    where.screen = { hostId: filters.hostId };
  }

  if (scope.role === "ADVERTISER" && scope.advertiserId) {
    where.placement = { advertiserId: scope.advertiserId };
  } else if (filters.advertiserId) {
    where.placement = { advertiserId: filters.advertiserId };
  }

  if (filters.screenId) {
    where.screenId = filters.screenId;
  } else if (scope.screenIds?.length) {
    where.screenId = { in: scope.screenIds };
  }

  const schedules = await prisma.schedule.findMany({
    where,
    include: {
      placement: {
        include: {
          creative: { select: { id: true, name: true } },
          advertiser: { select: { id: true, email: true } },
        },
      },
      screen: {
        include: {
          host: { select: { id: true, name: true, timezone: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const counts: Record<WindowPhase, number> = {
    ACTIVE: 0,
    SCHEDULED: 0,
    EXPIRED: 0,
    DRAFT: 0,
    CANCELLED: 0,
  };

  const rows: CampaignRow[] = schedules.map((s) => {
    const tz = s.screen.host.timezone || DEFAULT_TIMEZONE;
    const phase = scheduleWindowPhase(s, tz, now);
    counts[phase] = (counts[phase] || 0) + 1;

    let windowStart: string | null = null;
    let windowEnd: string | null = null;
    if (s.kind === "RECURRING") {
      windowStart = s.campaignStartDate;
      windowEnd = s.campaignEndDate;
    } else {
      windowStart = s.startAt
        ? formatInTimeZone(s.startAt, tz, "yyyy-MM-dd HH:mm")
        : null;
      windowEnd = s.endAt
        ? formatInTimeZone(s.endAt, tz, "yyyy-MM-dd HH:mm")
        : null;
    }

    return {
      scheduleId: s.id,
      kind: s.kind,
      status: s.status,
      phase,
      screenId: s.screenId,
      screenName: s.screen.name,
      hostId: s.screen.host.id,
      hostName: s.screen.host.name,
      timezone: tz,
      creativeId: s.placement.creative.id,
      creativeName: s.placement.creative.name,
      advertiserId: s.placement.advertiser.id,
      advertiserEmail: s.placement.advertiser.email,
      windowStart,
      windowEnd,
    };
  });

  return { counts, rows };
}

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function fillRowsToCsv(rows: FillRow[]): string {
  const headers = [
    "dayYmd",
    "screenId",
    "screenName",
    "hostId",
    "hostName",
    "timezone",
    "openMinutes",
    "closedMinutes",
    "paidMinutes",
    "emptyWhileOpenMinutes",
    "paidItems",
    "fillPct",
    "takenDown",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.dayYmd,
        r.screenId,
        r.screenName,
        r.hostId,
        r.hostName,
        r.timezone,
        String(r.openMinutes),
        String(r.closedMinutes),
        String(r.paidMinutes),
        String(r.emptyWhileOpenMinutes),
        String(r.paidItems),
        r.fillPct == null ? "" : String(r.fillPct),
        r.takenDown ? "true" : "false",
      ]
        .map((c) => csvEscape(String(c)))
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
}

export function daypartHeatToCsv(result: DaypartHeatResult): string {
  const headers = ["weekday", "weekdayLabel", "hour", "scheduledPaidMinutes"];
  const lines = [headers.join(",")];
  for (let wd = 1; wd <= 7; wd++) {
    for (let hour = 0; hour < 24; hour++) {
      lines.push(
        [
          String(wd),
          WEEKDAY_LABELS[wd] || String(wd),
          String(hour),
          String(result.grid[wd][hour]),
        ]
          .map((c) => csvEscape(c))
          .join(",")
      );
    }
  }
  return lines.join("\n") + "\n";
}

export function campaignsToCsv(rows: CampaignRow[]): string {
  const headers = [
    "scheduleId",
    "kind",
    "status",
    "phase",
    "screenId",
    "screenName",
    "hostId",
    "hostName",
    "timezone",
    "creativeId",
    "creativeName",
    "advertiserId",
    "advertiserEmail",
    "windowStart",
    "windowEnd",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.scheduleId,
        r.kind,
        r.status,
        r.phase,
        r.screenId,
        r.screenName,
        r.hostId,
        r.hostName,
        r.timezone,
        r.creativeId,
        r.creativeName,
        r.advertiserId,
        r.advertiserEmail,
        r.windowStart ?? "",
        r.windowEnd ?? "",
      ]
        .map((c) => csvEscape(String(c)))
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
}

export { WEEKDAY_LABELS };
