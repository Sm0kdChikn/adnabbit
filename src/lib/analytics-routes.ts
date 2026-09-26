/**
 * Ticket T — shared GET handlers for analytics JSON + CSV.
 */
import { NextResponse } from "next/server";
import {
  campaignsToCsv,
  computeCampaigns,
  computeDaypartHeat,
  computeFill,
  daypartHeatToCsv,
  fillRowsToCsv,
  parseAnalyticsDateRange,
  parseAnalyticsFilters,
  type AnalyticsScope,
} from "./analytics";
import { requireAnalyticsScope } from "./analytics-auth";

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
      "Plays / PoP: awaits F2 device persistence; OptiSigns Looker remains production PoP.",
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
