import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { materializeEndedSchedules, scheduleInclude } from "@/lib/schedules";

type Ctx = { params: { id: string } };

/** Cancel a DRAFT or ACTIVE schedule. */
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  await materializeEndedSchedules([params.id]);

  const existing = await prisma.schedule.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }
  if (existing.status === "CANCELLED") {
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  }
  if (existing.status === "ENDED") {
    return NextResponse.json({ error: "Cannot cancel an ENDED schedule" }, { status: 400 });
  }

  const schedule = await prisma.schedule.update({
    where: { id: params.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: scheduleInclude,
  });

  return NextResponse.json({ schedule });
}
