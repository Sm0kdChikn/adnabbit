import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

type Ctx = { params: { id: string } };

/** PATCH /api/admin/folders/:id — rename */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const existing = await prisma.adminFolder.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name !== undefined ? body.name.trim() : existing.name;
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const folder = await prisma.adminFolder.update({
    where: { id: params.id },
    data: { name },
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });

  return NextResponse.json({ folder });
}

/**
 * DELETE /api/admin/folders/:id
 * Unfiles items (deletes AdminFolderItem rows) then deletes the folder.
 * Never deletes Host or Advertiser User rows.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const existing = await prisma.adminFolder.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminFolderItem.deleteMany({ where: { folderId: params.id } });
    await tx.adminFolder.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}
