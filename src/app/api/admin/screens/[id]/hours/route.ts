import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import {
  clearWeeklyHours,
  emptyWeekly,
  formatHoursSummary,
  loadWeeklyForTarget,
  replaceWeeklyHours,
  resolveOpenHoursForScreen,
  type WeeklyHourRow,
} from "@/lib/open-hours";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      useCustomHours: true,
      forceLiveUntil: true,
      host: { select: { id: true, name: true, timezone: true } },
    },
  });
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  const effective = await resolveOpenHoursForScreen(screen.id);
  const custom = screen.useCustomHours
    ? await loadWeeklyForTarget("SCREEN", screen.id)
    : { weekly: emptyWeekly(), rowCount: 0 };

  return NextResponse.json({
    screenId: screen.id,
    screenName: screen.name,
    hostId: screen.host.id,
    hostName: screen.host.name,
    timezone: screen.host.timezone,
    useCustomHours: screen.useCustomHours,
    forceLiveUntil: screen.forceLiveUntil?.toISOString() ?? null,
    customWeekly: custom.rowCount === 0 ? emptyWeekly() : custom.weekly,
    effective,
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      useCustomHours: true,
      hostId: true,
    },
  });
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  let body: {
    useCustomHours?: boolean;
    weekly?: WeeklyHourRow[];
    clearCustom?: boolean;
    /** ISO timestamp or null to clear. Admin-only force-live override. */
    forceLiveUntil?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let forceLiveUntil: Date | null | undefined = undefined;
  if (body.forceLiveUntil !== undefined) {
    if (body.forceLiveUntil === null || body.forceLiveUntil === "") {
      forceLiveUntil = null;
    } else {
      const d = new Date(body.forceLiveUntil);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "forceLiveUntil must be a valid ISO timestamp or null" },
          { status: 400 }
        );
      }
      forceLiveUntil = d;
    }
  }

  if (body.clearCustom) {
    await clearWeeklyHours("SCREEN", screen.id);
    await prisma.screen.update({
      where: { id: screen.id },
      data: {
        useCustomHours: false,
        ...(forceLiveUntil !== undefined ? { forceLiveUntil } : {}),
      },
    });
    const effective = await resolveOpenHoursForScreen(screen.id);
    return NextResponse.json({ ok: true, useCustomHours: false, effective });
  }

  const useCustom =
    body.useCustomHours !== undefined
      ? !!body.useCustomHours
      : screen.useCustomHours;

  if (useCustom && body.weekly) {
    try {
      await replaceWeeklyHours("SCREEN", screen.id, body.weekly);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid hours" },
        { status: 400 }
      );
    }
  } else if (useCustom && !screen.useCustomHours && !body.weekly) {
    const hostHours = await loadWeeklyForTarget("HOST", screen.hostId);
    if (hostHours.rowCount > 0) {
      await replaceWeeklyHours("SCREEN", screen.id, hostHours.weekly);
    }
  }

  await prisma.screen.update({
    where: { id: screen.id },
    data: {
      useCustomHours: useCustom,
      ...(forceLiveUntil !== undefined ? { forceLiveUntil } : {}),
    },
  });

  const effective = await resolveOpenHoursForScreen(screen.id);
  const custom = await loadWeeklyForTarget("SCREEN", screen.id);

  return NextResponse.json({
    ok: true,
    useCustomHours: useCustom,
    forceLiveUntil: effective.forceLiveUntil,
    customWeekly: custom.rowCount === 0 ? emptyWeekly() : custom.weekly,
    summary: formatHoursSummary(effective.weekly),
    effective,
  });
}
