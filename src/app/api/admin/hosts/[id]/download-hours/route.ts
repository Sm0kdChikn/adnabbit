import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { writeAuditEvent } from "@/lib/audit";
import { emptyWeekly, type WeeklyHourRow } from "@/lib/open-hours";
import {
  clearDownloadWeeklyHours,
  replaceDownloadWeeklyHours,
  resolveDownloadHoursForHost,
} from "@/lib/download-hours";

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

  const payload = await resolveDownloadHoursForHost(host.id, host.timezone);
  return NextResponse.json({
    hostId: host.id,
    hostName: host.name,
    ...payload,
    weekly: payload.alwaysAllow ? emptyWeekly() : payload.weekly,
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const host = await prisma.host.findUnique({
    where: { id: params.id },
    select: { id: true, timezone: true },
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
    await clearDownloadWeeklyHours(host.id);
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "download_hours.save",
      targetType: "host",
      targetId: host.id,
      meta: { clear: true, alwaysAllow: true },
    });
    const payload = await resolveDownloadHoursForHost(host.id, host.timezone);
    return NextResponse.json({ ok: true, ...payload, weekly: emptyWeekly() });
  }

  if (!body.weekly) {
    return NextResponse.json({ error: "weekly is required" }, { status: 400 });
  }

  try {
    await replaceDownloadWeeklyHours(host.id, body.weekly);
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "download_hours.save",
      targetType: "host",
      targetId: host.id,
      meta: { clear: false },
    });
    const payload = await resolveDownloadHoursForHost(host.id, host.timezone);
    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid hours" },
      { status: 400 }
    );
  }
}
