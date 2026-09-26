import { NextResponse } from "next/server";
import { requireHostApi } from "@/lib/host";
import { writeAuditEvent } from "@/lib/audit";
import { emptyWeekly, type WeeklyHourRow } from "@/lib/open-hours";
import {
  clearDownloadWeeklyHours,
  replaceDownloadWeeklyHours,
  resolveDownloadHoursForHost,
} from "@/lib/download-hours";

export async function GET() {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const payload = await resolveDownloadHoursForHost(
    auth.host.id,
    auth.host.timezone
  );
  return NextResponse.json({
    hostId: auth.host.id,
    ...payload,
    weekly: payload.alwaysAllow ? emptyWeekly() : payload.weekly,
  });
}

export async function PUT(req: Request) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  let body: { weekly?: WeeklyHourRow[]; clear?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.clear) {
    await clearDownloadWeeklyHours(auth.host.id);
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "download_hours.save",
      targetType: "host",
      targetId: auth.host.id,
      meta: { clear: true, alwaysAllow: true, via: "host" },
    });
    const payload = await resolveDownloadHoursForHost(
      auth.host.id,
      auth.host.timezone
    );
    return NextResponse.json({ ok: true, ...payload, weekly: emptyWeekly() });
  }

  if (!body.weekly) {
    return NextResponse.json({ error: "weekly is required" }, { status: 400 });
  }

  try {
    await replaceDownloadWeeklyHours(auth.host.id, body.weekly);
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "download_hours.save",
      targetType: "host",
      targetId: auth.host.id,
      meta: { clear: false, via: "host" },
    });
    const payload = await resolveDownloadHoursForHost(
      auth.host.id,
      auth.host.timezone
    );
    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid hours" },
      { status: 400 }
    );
  }
}
