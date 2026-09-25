import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import {
  findOverlappingActiveSchedules,
  isValidYmd,
  materializeEndedSchedules,
  parseRecurringTimes,
  parseWeekdaysCsv,
  scheduleInclude,
  weekdaysToCsv,
  ymdCompare,
} from "@/lib/schedules";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  await materializeEndedSchedules([params.id]);

  const schedule = await prisma.schedule.findUnique({
    where: { id: params.id },
    include: scheduleInclude,
  });
  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }
  return NextResponse.json({ schedule });
}

const patchSchema = z.object({
  kind: z.enum(["ONE_OFF", "RECURRING"]).optional(),
  startAt: z.string().min(1).optional().nullable(),
  endAt: z.string().min(1).optional().nullable(),
  weekdays: z.string().min(1).optional().nullable(),
  startTime: z.string().min(1).optional().nullable(),
  endTime: z.string().min(1).optional().nullable(),
  campaignStartDate: z.string().min(1).optional().nullable(),
  campaignEndDate: z.string().min(1).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional(),
  note: z.string().max(2000).optional().nullable(),
  acknowledgeOverlap: z.boolean().optional().default(false),
});

/** Edit schedule fields / status (DRAFT|ACTIVE) / note. Cannot mutate CANCELLED/ENDED. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  await materializeEndedSchedules([params.id]);

  const existing = await prisma.schedule.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }
  if (existing.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot edit a CANCELLED schedule" }, { status: 400 });
  }
  if (existing.status === "ENDED") {
    return NextResponse.json({ error: "Cannot edit an ENDED schedule" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const kind = parsed.data.kind ?? existing.kind;
  const nextStatus = parsed.data.status ?? existing.status;

  let next: {
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
  };

  if (kind === "ONE_OFF") {
    const startRaw =
      parsed.data.startAt !== undefined ? parsed.data.startAt : existing.startAt?.toISOString();
    const endRaw =
      parsed.data.endAt !== undefined ? parsed.data.endAt : existing.endAt?.toISOString();
    if (!startRaw || !endRaw) {
      return NextResponse.json(
        { error: "startAt and endAt are required for ONE_OFF" },
        { status: 400 }
      );
    }
    const startAt = new Date(startRaw);
    const endAt = new Date(endRaw);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return NextResponse.json({ error: "Invalid startAt or endAt" }, { status: 400 });
    }
    if (!(endAt > startAt)) {
      return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
    }
    next = {
      kind: "ONE_OFF",
      startAt,
      endAt,
      weekdays: null,
      startTime: null,
      endTime: null,
      campaignStartDate: null,
      campaignEndDate: null,
      status: nextStatus,
      note:
        parsed.data.note !== undefined
          ? parsed.data.note?.trim() || null
          : existing.note,
    };
  } else {
    const weekdaysRaw =
      parsed.data.weekdays !== undefined ? parsed.data.weekdays : existing.weekdays;
    const days = weekdaysRaw ? parseWeekdaysCsv(weekdaysRaw) : null;
    if (!days) {
      return NextResponse.json(
        { error: "weekdays must be ISO Mon=1..Sun=7 CSV" },
        { status: 400 }
      );
    }
    const startTimeRaw =
      (parsed.data.startTime !== undefined ? parsed.data.startTime : existing.startTime)?.trim() ||
      "";
    const endTimeRaw =
      (parsed.data.endTime !== undefined ? parsed.data.endTime : existing.endTime)?.trim() || "";
    const times = parseRecurringTimes(startTimeRaw, endTimeRaw);
    if (!times.ok) {
      return NextResponse.json({ error: times.error }, { status: 400 });
    }
    const { startTime, endTime } = times;
    const campaignStartDate =
      (parsed.data.campaignStartDate !== undefined
        ? parsed.data.campaignStartDate
        : existing.campaignStartDate
      )?.trim() || "";
    const campaignEndDate =
      (parsed.data.campaignEndDate !== undefined
        ? parsed.data.campaignEndDate
        : existing.campaignEndDate
      )?.trim() || "";
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
    next = {
      kind: "RECURRING",
      startAt: null,
      endAt: null,
      weekdays: weekdaysToCsv(days),
      startTime,
      endTime,
      campaignStartDate,
      campaignEndDate,
      status: nextStatus,
      note:
        parsed.data.note !== undefined
          ? parsed.data.note?.trim() || null
          : existing.note,
    };
  }

  if (nextStatus === "ACTIVE") {
    const overlaps = await findOverlappingActiveSchedules({
      screenId: existing.screenId,
      candidate: { ...next, id: existing.id },
      excludeId: existing.id,
    });
    if (overlaps.length > 0 && !parsed.data.acknowledgeOverlap) {
      return NextResponse.json(
        {
          warning: "Overlapping ACTIVE schedule(s) on the same screen",
          overlaps,
          requireAcknowledge: true,
        },
        { status: 409 }
      );
    }
  }

  const schedule = await prisma.schedule.update({
    where: { id: params.id },
    data: next,
    include: scheduleInclude,
  });

  return NextResponse.json({ schedule });
}
