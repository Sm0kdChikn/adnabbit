import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { isAdminFolderScope } from "@/lib/types";

/**
 * PATCH /api/admin/folders/reorder
 * Body: { scope: HOST|ADVERTISER, orderedIds: string[] }
 */
export async function PATCH(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { scope?: string; orderedIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scope = (body.scope || "").trim();
  const orderedIds = body.orderedIds;

  if (!isAdminFolderScope(scope)) {
    return NextResponse.json(
      { error: "scope must be HOST or ADVERTISER" },
      { status: 400 }
    );
  }
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { error: "orderedIds must be a string array" },
      { status: 400 }
    );
  }

  const existing = await prisma.adminFolder.findMany({
    where: { scope },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((f) => f.id));
  if (
    orderedIds.length !== existingIds.size ||
    orderedIds.some((id) => !existingIds.has(id))
  ) {
    return NextResponse.json(
      { error: "orderedIds must include each folder in scope exactly once" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.adminFolder.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  const folders = await prisma.adminFolder.findMany({
    where: { scope },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });

  return NextResponse.json({ folders });
}
