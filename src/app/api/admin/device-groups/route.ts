import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { writeAuditEvent } from "@/lib/audit";
import { listDeviceGroups, getDeviceGroupDetail } from "@/lib/device-groups";

/** GET /api/admin/device-groups — list with member counts */
export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const groups = await listDeviceGroups();
  return NextResponse.json({ groups });
}

/** POST /api/admin/device-groups — create { name, note? } */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { name?: string; note?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.length > 120) {
    return NextResponse.json({ error: "name too long (max 120)" }, { status: 400 });
  }

  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    note = String(body.note).trim() || null;
    if (note && note.length > 500) {
      return NextResponse.json({ error: "note too long (max 500)" }, { status: 400 });
    }
  }

  const created = await prisma.deviceGroup.create({
    data: { name, note },
  });

  await writeAuditEvent({
    actorUserId: auth.user.id,
    action: "device_group.create",
    targetType: "device_group",
    targetId: created.id,
    meta: { name: created.name, note: created.note },
  });

  const detail = await getDeviceGroupDetail(created.id);
  return NextResponse.json({ group: detail }, { status: 201 });
}
