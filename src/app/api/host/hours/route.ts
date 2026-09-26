import { NextResponse } from "next/server";
import { requireHostApi } from "@/lib/host";
import {
  clearWeeklyHours,
  emptyWeekly,
  formatHoursSummary,
  loadWeeklyForTarget,
  replaceWeeklyHours,
  type WeeklyHourRow,
} from "@/lib/open-hours";

export async function GET() {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const { weekly, rowCount } = await loadWeeklyForTarget("HOST", auth.host.id);
  return NextResponse.json({
    hostId: auth.host.id,
    timezone: auth.host.timezone,
    alwaysOpen: rowCount === 0,
    weekly: rowCount === 0 ? emptyWeekly() : weekly,
    summary: rowCount === 0 ? "Always open (no hours set)" : formatHoursSummary(weekly),
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
    await clearWeeklyHours("HOST", auth.host.id);
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
    const weekly = await replaceWeeklyHours("HOST", auth.host.id, body.weekly);
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
