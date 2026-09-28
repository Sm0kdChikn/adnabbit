/**
 * Ticket T — shared GET handlers for analytics JSON + CSV.
 */
import { NextResponse } from "next/server";
import {
  campaignsToCsv,
  computeCampaigns,
  computeDaypartHeat,
  computeFill,
  computePlays,
  daypartHeatToCsv,
  fetchPlayLogExportRows,
  fillRowsToCsv,
  playsToCsv,
  parseAnalyticsDateRange,
  parseAnalyticsFilters,
  PLAY_LOG_EXPORT_ROW_CAP,
  type AnalyticsFilters,
  type AnalyticsScope,
} from "./analytics";
import { requireAnalyticsScope } from "./analytics-auth";
import { playLogRowsToXlsx, playsSummaryToPdf } from "./analytics-export";

function queryFrom(req: Request) {
  const url = new URL(req.url);
  return {
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    range: url.searchParams.get("range"),
    hostId: url.searchParams.get("hostId"),
    screenId: url.searchParams.get("screenId"),
    advertiserId: url.searchParams.get("advertiserId"),
    table: url.searchParams.get("table"),
  };
}

async function withScope(
  allowed: Array<AnalyticsScope["role"]>
): Promise<
  | { scope: AnalyticsScope; error?: undefined }
  | { scope?: undefined; error: NextResponse }
> {
  const auth = await requireAnalyticsScope();
  if (auth.error) return auth;
  if (!allowed.includes(auth.scope.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  // Hosts/advertisers may not pass hostId/advertiserId that escapes scope —
  // filters are still applied but scope clamps ownership in compute*.
  return auth;
}

/** Clamp client filters so HOST/ADVERTISER cannot widen via query params. */
export function clampAnalyticsFilters(
  scope: AnalyticsScope,
  filters: AnalyticsFilters
): AnalyticsFilters {
  if (scope.role === "HOST") {
    return {
      ...filters,
      hostId: scope.hostId,
      advertiserId: null,
    };
  }
  if (scope.role === "ADVERTISER") {
    return {
      ...filters,
      advertiserId: scope.advertiserId,
    };
  }
  return filters;
}

export async function handleFillGet(
  req: Request,
  allowed: Array<AnalyticsScope["role"]>
) {
  const auth = await withScope(allowed);
  if (auth.error) return auth.error;
  const q = queryFrom(req);
  const range = parseAnalyticsDateRange(q);
  const filters = parseAnalyticsFilters(q);
  // Non-admins cannot widen via filter hostId/advertiserId
  if (auth.scope.role === "HOST") {
    filters.hostId = auth.scope.hostId;
    filters.advertiserId = null;
  }
  if (auth.scope.role === "ADVERTISER") {
    filters.advertiserId = auth.scope.advertiserId;
    filters.hostId = filters.hostId; // ok as read filter on their screens
  }
  const data = await computeFill(auth.scope, range, filters);
  return NextResponse.json({
    range,
    filters,
    summary: data.summary,
    rows: data.rows,
    notes: [
      "Fill uses OpenHours + ACTIVE schedule expansion (playlist truth).",
      "Paid minutes are union coverage within open hours — not play counts.",
      "force-live overrides are not replayed historically (configured hours only).",
      "Plays: first-party PlayLog soak (Ticket F2). OptiSigns Looker remains production PoP.",
    ],
  });
}

export async function handleDaypartHeatGet(
  req: Request,
  allowed: Array<AnalyticsScope["role"]>
) {
  const auth = await withScope(allowed);
  if (auth.error) return auth.error;
  const q = queryFrom(req);
  const range = parseAnalyticsDateRange(q);
  const filters = parseAnalyticsFilters(q);
  if (auth.scope.role === "HOST") {
    filters.hostId = auth.scope.hostId;
    filters.advertiserId = null;
  }
  if (auth.scope.role === "ADVERTISER") {
    filters.advertiserId = auth.scope.advertiserId;
  }
  const data = await computeDaypartHeat(auth.scope, range, filters);
  return NextResponse.json({
    range,
    filters,
    timezoneHint: data.timezoneHint,
    totalMinutes: data.totalMinutes,
    grid: data.grid,
    cells: data.cells,
    notes: [
      "Cells are scheduled paid minutes (summed across days in range), not plays.",
    ],
  });
}

export async function handleCampaignsGet(
  req: Request,
  allowed: Array<AnalyticsScope["role"]>
) {
  const auth = await withScope(allowed);
  if (auth.error) return auth.error;
  const q = queryFrom(req);
  const filters = parseAnalyticsFilters(q);
  if (auth.scope.role === "HOST") {
    filters.hostId = auth.scope.hostId;
    filters.advertiserId = null;
  }
  if (auth.scope.role === "ADVERTISER") {
    filters.advertiserId = auth.scope.advertiserId;
  }
  const data = await computeCampaigns(auth.scope, filters);
  return NextResponse.json({
    filters,
    counts: data.counts,
    rows: data.rows,
  });
}


export async function handlePlaysGet(
  req: Request,
  allowed: Array<AnalyticsScope["role"]>
) {
  const auth = await withScope(allowed);
  if (auth.error) return auth.error;
  const q = queryFrom(req);
  const range = parseAnalyticsDateRange(q);
  const filters = parseAnalyticsFilters(q);
  if (auth.scope.role === "HOST") {
    filters.hostId = auth.scope.hostId;
    filters.advertiserId = null;
  }
  if (auth.scope.role === "ADVERTISER") {
    filters.advertiserId = auth.scope.advertiserId;
  }
  const data = await computePlays(auth.scope, range, filters);
  return NextResponse.json({
    range,
    filters,
    summary: data.summary,
    rows: data.rows,
    charts: data.charts,
    notes: [
      "Played charts use first-party PlayLog only (Ticket POP-CHARTS / F2).",
      "Never blended with OptiSigns PlayEvent. Scheduled fill/heat remain Ticket T.",
      "Mute paths (closed hours / maintenance / take-down) produce zero new rows.",
    ],
  });
}

export async function handleExportGet(
  req: Request,
  allowed: Array<AnalyticsScope["role"]>
) {
  const auth = await withScope(allowed);
  if (auth.error) return auth.error;
  const q = queryFrom(req);
  const range = parseAnalyticsDateRange(q);
  const filters = parseAnalyticsFilters(q);
  if (auth.scope.role === "HOST") {
    filters.hostId = auth.scope.hostId;
    filters.advertiserId = null;
  }
  if (auth.scope.role === "ADVERTISER") {
    filters.advertiserId = auth.scope.advertiserId;
  }

  const table = (q.table || "fill").toLowerCase();
  let csv: string;
  let filename: string;

  if (table === "daypart" || table === "daypart-heat") {
    const data = await computeDaypartHeat(auth.scope, range, filters);
    csv = daypartHeatToCsv(data);
    filename = `adnabbit-daypart-heat-${range.fromYmd}_${range.toYmd}.csv`;
  } else if (table === "campaigns") {
    const data = await computeCampaigns(auth.scope, filters);
    csv = campaignsToCsv(data.rows);
    filename = `adnabbit-campaigns.csv`;
  } else if (table === "plays") {
    const data = await computePlays(auth.scope, range, filters);
    csv = playsToCsv(data.rows);
    filename = `adnabbit-plays-${range.fromYmd}_${range.toYmd}.csv`;
  } else {
    const data = await computeFill(auth.scope, range, filters);
    csv = fillRowsToCsv(data.rows);
    filename = `adnabbit-fill-${range.fromYmd}_${range.toYmd}.csv`;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Ticket POP-EXPORT — Excel dump of raw PlayLog rows (same filters as UI). */
export async function handlePlaysExportXlsxGet(
  req: Request,
  allowed: Array<AnalyticsScope["role"]>
) {
  const auth = await withScope(allowed);
  if (auth.error) return auth.error;
  const q = queryFrom(req);
  const range = parseAnalyticsDateRange(q);
  const filters = clampAnalyticsFilters(
    auth.scope,
    parseAnalyticsFilters(q)
  );

  const fetched = await fetchPlayLogExportRows(auth.scope, range, filters);
  if (fetched.overCap) {
    return NextResponse.json(
      {
        error: `Too many PlayLog rows (${fetched.count}). Cap is ${PLAY_LOG_EXPORT_ROW_CAP}. Narrow the date range or filters.`,
        count: fetched.count,
        cap: PLAY_LOG_EXPORT_ROW_CAP,
      },
      { status: 400 }
    );
  }

  const buf = await playLogRowsToXlsx(fetched.rows, {
    role: auth.scope.role,
    range,
  });
  const filename = `adnabbit-plays-${range.fromYmd}_${range.toYmd}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Ticket POP-EXPORT — printable PDF summary (PlayLog totals / by-day / tops). */
export async function handlePlaysExportPdfGet(
  req: Request,
  allowed: Array<AnalyticsScope["role"]>
) {
  const auth = await withScope(allowed);
  if (auth.error) return auth.error;
  const q = queryFrom(req);
  const range = parseAnalyticsDateRange(q);
  const filters = clampAnalyticsFilters(
    auth.scope,
    parseAnalyticsFilters(q)
  );

  // Reuse computePlays aggregates (same scope helper as charts)
  const data = await computePlays(auth.scope, range, filters);
  if (data.summary.playCount > PLAY_LOG_EXPORT_ROW_CAP) {
    return NextResponse.json(
      {
        error: `Too many PlayLog rows (${data.summary.playCount}). Cap is ${PLAY_LOG_EXPORT_ROW_CAP}. Narrow the date range or filters.`,
        count: data.summary.playCount,
        cap: PLAY_LOG_EXPORT_ROW_CAP,
      },
      { status: 400 }
    );
  }

  const buf = await playsSummaryToPdf(data, {
    role: auth.scope.role,
    range,
  });
  const filename = `adnabbit-plays-${range.fromYmd}_${range.toYmd}.pdf`;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
