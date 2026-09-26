import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { writeAuditEvent } from "@/lib/audit";
import {
  clearWeeklyHours,
  emptyWeekly,
  formatHoursSummary,
  loadWeeklyForTarget,
  replaceWeeklyHours,
  type WeeklyHourRow,
} from "@/lib/open-hours";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const host = await prisma.host.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, timezone: true },
  });
  if (!host) {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  const { weekly, rowCount } = await loadWeeklyForTarget("HOST", host.id);
  return NextResponse.json({
    hostId: host.id,
    hostName: host.name,
    timezone: host.timezone,
    alwaysOpen: rowCount === 0,
    weekly: rowCount === 0 ? emptyWeekly() : weekly,
    summary: rowCount === 0 ? "Always open (no hours set)" : formatHoursSummary(weekly),
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const host = await prisma.host.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!host) {
    return NextResponse.json({ error: "Host not found" }, { status: 404 });
  }

  let body: { weekly?: WeeklyHourRow[]; clear?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.clear) {
    await clearWeeklyHours("HOST", host.id);
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "open_hours.save",
      targetType: "host",
      targetId: host.id,
      meta: { clear: true, alwaysOpen: true },
    });
    return NextResponse.json({
      ok: true,
      alwaysOpen: true,
      weekly: emptyWeekly(),
      summary: "Always open (no hours set)",
    });
  }

  if (!body.weekly) {
    return NextResponse.json({ error: "weekly is required" }, { status: 400 });
  }

  try {
    const weekly = await replaceWeeklyHours("HOST", host.id, body.weekly);
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "open_hours.save",
      targetType: "host",
      targetId: host.id,
      meta: { clear: false, weekdayCount: weekly.filter((r) => r.openTime && r.closeTime).length },
    });
    return NextResponse.json({
      ok: true,
      alwaysOpen: false,
      weekly,
      summary: formatHoursSummary(weekly),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid hours" },
      { status: 400 }
    );
  }
}
