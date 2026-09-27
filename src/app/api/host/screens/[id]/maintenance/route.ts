import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHostApi } from "@/lib/host";
import {
  clearMaintenanceWindows,
  createMaintenanceWindow,
  listMaintenanceWindows,
  parseMaintenanceBody,
  resolveMaintenanceForScreen,
} from "@/lib/maintenance";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findFirst({
    where: { id: params.id, hostId: auth.host.id },
    select: { id: true, name: true },
  });
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  const [windows, effective, hostWindows] = await Promise.all([
    listMaintenanceWindows({ scope: "SCREEN", targetId: screen.id }),
    resolveMaintenanceForScreen(screen.id),
    listMaintenanceWindows({ scope: "HOST", targetId: auth.host.id }),
  ]);

  return NextResponse.json({
    scope: "SCREEN",
    targetId: screen.id,
    screenName: screen.name,
    hostId: auth.host.id,
    windows,
    hostWindows,
    effective,
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findFirst({
    where: { id: params.id, hostId: auth.host.id },
    select: { id: true },
  });
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  let body: { startsAt?: unknown; endsAt?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseMaintenanceBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await createMaintenanceWindow({
    scope: "SCREEN",
    targetId: screen.id,
    startsAt: parsed.startsAt,
    endsAt: parsed.endsAt,
    createdById: auth.user.id,
    note: parsed.note,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const effective = await resolveMaintenanceForScreen(screen.id);
  return NextResponse.json({ ...result, effective });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findFirst({
    where: { id: params.id, hostId: auth.host.id },
    select: { id: true },
  });
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  let windowId: string | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.windowId === "string") {
      windowId = body.windowId.trim() || null;
    }
  } catch {
    /* optional */
  }
  const url = new URL(req.url);
  if (!windowId && url.searchParams.get("id")) {
    windowId = url.searchParams.get("id");
  }

  const result = await clearMaintenanceWindows({
    scope: "SCREEN",
    targetId: screen.id,
    actorUserId: auth.user.id,
    windowId,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const effective = await resolveMaintenanceForScreen(screen.id);
  return NextResponse.json({ ...result, effective });
}
