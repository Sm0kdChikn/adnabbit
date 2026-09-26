import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHostApi } from "@/lib/host";
import { writeAuditEvent } from "@/lib/audit";
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

async function ownedScreen(hostId: string, screenId: string) {
  return prisma.screen.findFirst({
    where: { id: screenId, hostId },
    select: {
      id: true,
      name: true,
      useCustomHours: true,
      forceLiveUntil: true,
    },
  });
}

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const screen = await ownedScreen(auth.host.id, params.id);
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
    useCustomHours: screen.useCustomHours,
    forceLiveUntil: screen.forceLiveUntil?.toISOString() ?? null,
    customWeekly: custom.rowCount === 0 ? emptyWeekly() : custom.weekly,
    effective,
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const screen = await ownedScreen(auth.host.id, params.id);
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  let body: {
    useCustomHours?: boolean;
    weekly?: WeeklyHourRow[];
    clearCustom?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.clearCustom) {
    await clearWeeklyHours("SCREEN", screen.id);
    await prisma.screen.update({
      where: { id: screen.id },
      data: { useCustomHours: false },
    });
    await writeAuditEvent({
      actorUserId: auth.user.id,
      action: "open_hours.save",
      targetType: "screen",
      targetId: screen.id,
      meta: { clearCustom: true, useCustomHours: false, via: "host" },
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
  } else if (useCustom && !screen.useCustomHours) {
    // Enabling custom without weekly → copy host hours as starting point
    const hostHours = await loadWeeklyForTarget("HOST", auth.host.id);
    const seed =
      hostHours.rowCount > 0 ? hostHours.weekly : emptyWeekly();
    // If host was always-open, seed Mon–Fri 9–5 as a sensible default? Keep empty → always open until edited.
    if (hostHours.rowCount > 0) {
      await replaceWeeklyHours("SCREEN", screen.id, seed);
    }
  } else if (!useCustom) {
    // Switching back to inherit — keep SCREEN rows but ignore them
  }

  await prisma.screen.update({
    where: { id: screen.id },
    data: { useCustomHours: useCustom },
  });

  await writeAuditEvent({
    actorUserId: auth.user.id,
    action: "open_hours.save",
    targetType: "screen",
    targetId: screen.id,
    meta: {
      useCustomHours: useCustom,
      weeklyProvided: Array.isArray(body.weekly),
      via: "host",
    },
  });

  const effective = await resolveOpenHoursForScreen(screen.id);
  const custom = await loadWeeklyForTarget("SCREEN", screen.id);

  return NextResponse.json({
    ok: true,
    useCustomHours: useCustom,
    customWeekly: custom.rowCount === 0 ? emptyWeekly() : custom.weekly,
    summary: formatHoursSummary(effective.weekly),
    effective,
  });
}
