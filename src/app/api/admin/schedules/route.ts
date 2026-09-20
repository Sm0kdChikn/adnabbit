import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { isScheduleStatus } from "@/lib/types";
import {
  findOverlappingActiveSchedules,
  materializeEndedSchedules,
  scheduleInclude,
} from "@/lib/schedules";

/** Admin list — filter by screenId, status, date range (from/to). */
export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  await materializeEndedSchedules();

  const { searchParams } = new URL(req.url);
  const screenId = searchParams.get("screenId")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const from = searchParams.get("from")?.trim() || "";
  const to = searchParams.get("to")?.trim() || "";
  const placementId = searchParams.get("placementId")?.trim() || "";

  if (status && status !== "ALL" && !isScheduleStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (screenId) where.screenId = screenId;
  if (placementId) where.placementId = placementId;
  if (status && status !== "ALL") where.status = status;

  // Date range: schedules that overlap [from, to]
  if (from || to) {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && Number.isNaN(fromDate.getTime())) {
      return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
      return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
    }
    if (fromDate && toDate) {
      where.startAt = { lt: toDate };
      where.endAt = { gt: fromDate };
    } else if (fromDate) {
      where.endAt = { gt: fromDate };
    } else if (toDate) {
      where.startAt = { lt: toDate };
    }
  }

  const schedules = await prisma.schedule.findMany({
    where,
    orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
    include: scheduleInclude,
  });

  return NextResponse.json({ schedules });
}

const createSchema = z.object({
  placementId: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
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

  const { placementId, note, acknowledgeOverlap } = parsed.data;
  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ error: "Invalid startAt or endAt" }, { status: 400 });
  }
  if (!(endAt > startAt)) {
    return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
  }

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

  const overlaps = await findOverlappingActiveSchedules({
    screenId: placement.screenId,
    startAt,
    endAt,
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
    data: {
      placementId: placement.id,
      screenId: placement.screenId,
      startAt,
      endAt,
      status: parsed.data.status,
      note: note?.trim() || null,
      createdById: auth.user!.id,
    },
    include: scheduleInclude,
  });

  return NextResponse.json(
    { schedule, overlaps: overlaps.length ? overlaps : undefined },
    { status: 201 }
  );
}
