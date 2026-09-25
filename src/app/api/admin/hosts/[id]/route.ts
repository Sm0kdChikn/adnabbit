import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { isHostVertical } from "@/lib/types";
import { isValidTimeZone } from "@/lib/schedules";
import { cleanupHostFolderItem } from "@/lib/folders";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const host = await prisma.host.findUnique({
    where: { id: params.id },
    include: {
      screens: { orderBy: { name: "asc" } },
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });
  if (!host) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ host });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const existing = await prisma.host.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    name?: string;
    vertical?: string;
    otherLabel?: string | null;
    notes?: string | null;
    timezone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name !== undefined ? body.name.trim() : existing.name;
  const vertical =
    body.vertical !== undefined ? body.vertical.trim() : existing.vertical;
  let otherLabel =
    body.otherLabel !== undefined
      ? body.otherLabel?.trim() || null
      : existing.otherLabel;
  const notes =
    body.notes !== undefined ? body.notes?.trim() || null : existing.notes;
  const timezone =
    body.timezone !== undefined
      ? body.timezone.trim() || "America/Denver"
      : existing.timezone;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!isHostVertical(vertical)) {
    return NextResponse.json({ error: "Invalid vertical" }, { status: 400 });
  }
  if (vertical === "OTHER" && !otherLabel) {
    return NextResponse.json(
      { error: "otherLabel is required when vertical is OTHER" },
      { status: 400 }
    );
  }
  if (vertical !== "OTHER") {
    otherLabel = null;
  }

  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "Invalid IANA timezone" }, { status: 400 });
  }

  const host = await prisma.host.update({
    where: { id: params.id },
    data: { name, vertical, otherLabel, notes, timezone },
  });

  return NextResponse.json({ host });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const existing = await prisma.host.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await cleanupHostFolderItem(params.id);
  await prisma.host.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
