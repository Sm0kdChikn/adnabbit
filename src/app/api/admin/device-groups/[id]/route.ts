import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { writeAuditEvent } from "@/lib/audit";
import { getDeviceGroupDetail } from "@/lib/device-groups";

type Ctx = { params: { id: string } };

/** GET /api/admin/device-groups/:id — detail + members */
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const group = await getDeviceGroupDetail(params.id);
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ group });
}

/** PATCH /api/admin/device-groups/:id — rename / note */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const existing = await prisma.deviceGroup.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { name?: string; note?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { name?: string; note?: string | null } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (name.length > 120) {
      return NextResponse.json({ error: "name too long (max 120)" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.note !== undefined) {
    if (body.note === null) {
      data.note = null;
    } else {
      const note = String(body.note).trim() || null;
      if (note && note.length > 500) {
        return NextResponse.json({ error: "note too long (max 500)" }, { status: 400 });
      }
      data.note = note;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Provide name and/or note" },
      { status: 400 }
    );
  }

  await prisma.deviceGroup.update({
    where: { id: params.id },
    data,
  });

  await writeAuditEvent({
    actorUserId: auth.user.id,
    action: "device_group.update",
    targetType: "device_group",
    targetId: params.id,
    meta: data,
  });

  const group = await getDeviceGroupDetail(params.id);
  return NextResponse.json({ group });
}

/** DELETE /api/admin/device-groups/:id — cascade members */
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const existing = await prisma.deviceGroup.findUnique({
    where: { id: params.id },
    include: { _count: { select: { members: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.deviceGroup.delete({ where: { id: params.id } });

  await writeAuditEvent({
    actorUserId: auth.user.id,
    action: "device_group.delete",
    targetType: "device_group",
    targetId: params.id,
    meta: {
      name: existing.name,
      memberCount: existing._count.members,
    },
  });

  return NextResponse.json({ ok: true });
}
