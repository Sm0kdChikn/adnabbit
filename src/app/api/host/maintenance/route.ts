import { NextResponse } from "next/server";
import { requireHostApi } from "@/lib/host";
import {
  clearMaintenanceWindows,
  createMaintenanceWindow,
  listMaintenanceWindows,
  parseMaintenanceBody,
} from "@/lib/maintenance";

export async function GET() {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const windows = await listMaintenanceWindows({
    scope: "HOST",
    targetId: auth.host.id,
  });
  const active = windows.find((w) => w.active) || null;

  return NextResponse.json({
    scope: "HOST",
    targetId: auth.host.id,
    hostName: auth.host.name,
    windows,
    effective: active
      ? {
          active: true,
          endsAt: active.endsAt,
          startsAt: active.startsAt,
          scope: "HOST" as const,
          windowId: active.id,
          note: active.note,
        }
      : {
          active: false,
          endsAt: null,
          startsAt: null,
          scope: null,
          windowId: null,
          note: null,
        },
  });
}

export async function POST(req: Request) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

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
    scope: "HOST",
    targetId: auth.host.id,
    startsAt: parsed.startsAt,
    endsAt: parsed.endsAt,
    createdById: auth.user.id,
    note: parsed.note,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}

export async function DELETE(req: Request) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

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
    scope: "HOST",
    targetId: auth.host.id,
    actorUserId: auth.user.id,
    windowId,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
