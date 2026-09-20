import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { isScheduleKind, isScheduleStatus } from "@/lib/types";
import {
  findOverlappingActiveSchedules,
  isValidYmd,
  materializeEndedSchedules,
  parseHHMM,
  parseWeekdaysCsv,
  scheduleInclude,
  weekdaysToCsv,
  ymdCompare,
} from "@/lib/schedules";

/** Admin list — filter by screenId, status, kind, date range (from/to). */
export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  await materializeEndedSchedules();

  const { searchParams } = new URL(req.url);
  const screenId = searchParams.get("screenId")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const kind = searchParams.get("kind")?.trim() || "";
  const from = searchParams.get("from")?.trim() || "";
  const to = searchParams.get("to")?.trim() || "";
  const placementId = searchParams.get("placementId")?.trim() || "";

  if (status && status !== "ALL" && !isScheduleStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (kind && kind !== "ALL" && !isScheduleKind(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (screenId) where.screenId = screenId;
  if (placementId) where.placementId = placementId;
  if (status && status !== "ALL") where.status = status;
  if (kind && kind !== "ALL") where.kind = kind;

  // Date range filter: ONE_OFF via startAt/endAt; RECURRING via campaign dates.
  // Coarse OR then refine in memory for mixed kinds when from/to set.
  let schedules = await prisma.schedule.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: scheduleInclude,
  });

  if (from || to) {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && Number.isNaN(fromDate.getTime())) {
      return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
      return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
    }
    const fromYmd = from ? from.slice(0, 10) : null;
    const toYmd = to ? to.slice(0, 10) : null;

    schedules = schedules.filter((s) => {
      if (s.kind === "RECURRING") {
        const cs = s.campaignStartDate;
        const ce = s.campaignEndDate;
        if (!cs || !ce) return false;
        if (fromYmd && ymdCompare(ce, fromYmd) < 0) return false;
        if (toYmd && ymdCompare(cs, toYmd) > 0) return false;
        return true;
      }
      if (!s.startAt || !s.endAt) return false;
      if (fromDate && toDate) return s.startAt < toDate && s.endAt > fromDate;
      if (fromDate) return s.endAt > fromDate;
      if (toDate) return s.startAt < toDate;
      return true;
    });
  }

  // Stable-ish sort: ONE_OFF by startAt, RECURRING by campaignStartDate
  schedules.sort((a, b) => {
    const ak =
      a.kind === "RECURRING"
        ? a.campaignStartDate || ""
        : a.startAt?.toISOString() || "";
    const bk =
      b.kind === "RECURRING"
        ? b.campaignStartDate || ""
        : b.startAt?.toISOString() || "";
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });

  return NextResponse.json({ schedules });
}

const createSchema = z.object({
  placementId: z.string().min(1),
  kind: z.enum(["ONE_OFF", "RECURRING"]).optional().default("ONE_OFF"),
  startAt: z.string().min(1).optional(),
  endAt: z.string().min(1).optional(),
  weekdays: z.string().min(1).optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
  campaignStartDate: z.string().min(1).optional(),
  campaignEndDate: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional().default("DRAFT"),
  note: z.string().max(2000).optional().nullable(),
  /** When true, create even if overlapping ACTIVE on same screen (warn-first). */
  acknowledgeOverlap: z.boolean().optional().default(false),
});

/** Create schedule from APPROVED placement. Warns on same-screen ACTIVE overlap. */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { placementId, note, acknowledgeOverlap, kind } = parsed.data;

  const placement = await prisma.placementRequest.findUnique({
    where: { id: placementId },
  });
  if (!placement) {
    return NextResponse.json({ error: "Placement not found" }, { status: 404 });
  }
  if (placement.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Only APPROVED placements can be scheduled" },
      { status: 400 }
    );
  }

  let data: {
    placementId: string;
    screenId: string;
    kind: string;
    startAt: Date | null;
    endAt: Date | null;
    weekdays: string | null;
    startTime: string | null;
    endTime: string | null;
    campaignStartDate: string | null;
    campaignEndDate: string | null;
    status: string;
    note: string | null;
    createdById: string;
  };

  if (kind === "ONE_OFF") {
    if (!parsed.data.startAt || !parsed.data.endAt) {
      return NextResponse.json(
        { error: "startAt and endAt are required for ONE_OFF" },
        { status: 400 }
      );
    }
    const startAt = new Date(parsed.data.startAt);
    const endAt = new Date(parsed.data.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return NextResponse.json({ error: "Invalid startAt or endAt" }, { status: 400 });
    }
    if (!(endAt > startAt)) {
      return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
    }
    data = {
      placementId: placement.id,
      screenId: placement.screenId,
      kind: "ONE_OFF",
      startAt,
      endAt,
      weekdays: null,
      startTime: null,
      endTime: null,
      campaignStartDate: null,
      campaignEndDate: null,
      status: parsed.data.status,
      note: note?.trim() || null,
      createdById: auth.user!.id,
    };
  } else {
    const weekdaysRaw = parsed.data.weekdays || "";
    const days = parseWeekdaysCsv(weekdaysRaw);
    if (!days) {
      return NextResponse.json(
        { error: "weekdays must be ISO Mon=1..Sun=7 CSV" },
        { status: 400 }
      );
    }
    const startTime = (parsed.data.startTime || "").trim();
    const endTime = (parsed.data.endTime || "").trim();
    const t0 = parseHHMM(startTime);
    const t1 = parseHHMM(endTime);
    if (t0 === null || t1 === null) {
      return NextResponse.json(
        { error: "startTime and endTime must be HH:mm" },
        { status: 400 }
      );
    }
    if (!(t1 > t0)) {
      return NextResponse.json(
        { error: "endTime must be after startTime (same-day; no overnight)" },
        { status: 400 }
      );
    }
    const campaignStartDate = (parsed.data.campaignStartDate || "").trim();
    const campaignEndDate = (parsed.data.campaignEndDate || "").trim();
    if (!isValidYmd(campaignStartDate) || !isValidYmd(campaignEndDate)) {
      return NextResponse.json(
        { error: "campaignStartDate and campaignEndDate must be YYYY-MM-DD" },
        { status: 400 }
      );
    }
    if (ymdCompare(campaignEndDate, campaignStartDate) < 0) {
      return NextResponse.json(
        { error: "campaignEndDate must be on or after campaignStartDate" },
        { status: 400 }
      );
    }
    data = {
      placementId: placement.id,
      screenId: placement.screenId,
      kind: "RECURRING",
      startAt: null,
      endAt: null,
      weekdays: weekdaysToCsv(days),
      startTime,
      endTime,
      campaignStartDate,
      campaignEndDate,
      status: parsed.data.status,
      note: note?.trim() || null,
      createdById: auth.user!.id,
    };
  }

  const overlaps = await findOverlappingActiveSchedules({
    screenId: placement.screenId,
    candidate: data,
  });

  if (overlaps.length > 0 && !acknowledgeOverlap) {
    return NextResponse.json(
      {
        warning: "Overlapping ACTIVE schedule(s) on the same screen",
        overlaps,
        requireAcknowledge: true,
      },
      { status: 409 }
    );
  }

  const schedule = await prisma.schedule.create({
    data,
    include: scheduleInclude,
  });

  return NextResponse.json(
    { schedule, overlaps: overlaps.length ? overlaps : undefined },
    { status: 201 }
  );
}
