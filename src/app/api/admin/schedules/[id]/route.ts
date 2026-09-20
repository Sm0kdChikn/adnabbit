import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import {
  findOverlappingActiveSchedules,
  materializeEndedSchedules,
  scheduleInclude,
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
  startAt: z.string().min(1).optional(),
  endAt: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).optional(),
  note: z.string().max(2000).optional().nullable(),
  acknowledgeOverlap: z.boolean().optional().default(false),
});

/** Edit times / status (DRAFT|ACTIVE) / note. Cannot mutate CANCELLED. */
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

  const startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : existing.startAt;
  const endAt = parsed.data.endAt ? new Date(parsed.data.endAt) : existing.endAt;
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ error: "Invalid startAt or endAt" }, { status: 400 });
  }
  if (!(endAt > startAt)) {
    return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
  }

  const nextStatus = parsed.data.status ?? existing.status;

  // Overlap warn when resulting status would be ACTIVE
  if (nextStatus === "ACTIVE") {
    const overlaps = await findOverlappingActiveSchedules({
      screenId: existing.screenId,
      startAt,
      endAt,
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
    data: {
      startAt,
      endAt,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.note !== undefined
        ? { note: parsed.data.note?.trim() || null }
        : {}),
    },
    include: scheduleInclude,
  });

  return NextResponse.json({ schedule });
}
