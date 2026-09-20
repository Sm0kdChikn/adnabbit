import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { materializeEndedSchedules, scheduleInclude } from "@/lib/schedules";

/** Advertiser: list own schedules (via placement.advertiserId). Read-only. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADVERTISER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await materializeEndedSchedules();

  const schedules = await prisma.schedule.findMany({
    where: { placement: { advertiserId: session.user.id } },
    orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
    include: scheduleInclude,
  });

  return NextResponse.json({ schedules });
}
