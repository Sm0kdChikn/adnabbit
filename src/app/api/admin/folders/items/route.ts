import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { isAdminFolderScope } from "@/lib/types";
import { validateFolderTarget } from "@/lib/folders";

/**
 * PATCH /api/admin/folders/items
 *
 * Move one item:
 *   { targetType, targetId, folderId: string | null, sortOrder?: number }
 *   folderId null = unfile (delete AdminFolderItem)
 *
 * Or reorder items in a bucket:
 *   { targetType, folderId: string | null, orderedTargetIds: string[] }
 *   folderId null = reorder unfiled (noop for persistence of unfiled order —
 *   unfiled has no rows; for unfiled we only accept moves into folders.
 *   For reorder within a folder, persists sortOrder.)
 *
 * Soft: deep nesting / multi-select not supported.
 */
export async function PATCH(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: {
    targetType?: string;
    targetId?: string;
    folderId?: string | null;
    sortOrder?: number;
    orderedTargetIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetType = (body.targetType || "").trim();
  if (!isAdminFolderScope(targetType)) {
    return NextResponse.json(
      { error: "targetType must be HOST or ADVERTISER" },
      { status: 400 }
    );
  }

  // Bulk reorder within a folder
  if (Array.isArray(body.orderedTargetIds)) {
    const folderId = body.folderId === undefined ? undefined : body.folderId;
    if (folderId === undefined) {
      return NextResponse.json(
        { error: "folderId is required for reorder (use null for unfiled no-op)" },
        { status: 400 }
      );
    }
    if (folderId === null) {
      // Unfiled has no AdminFolderItem rows — nothing to persist
      return NextResponse.json({ ok: true, unfiled: true });
    }

    const folder = await prisma.adminFolder.findUnique({
      where: { id: folderId },
    });
    if (!folder || folder.scope !== targetType) {
      return NextResponse.json(
        { error: "Folder not found for scope" },
        { status: 404 }
      );
    }

    const orderedTargetIds = body.orderedTargetIds;
    if (orderedTargetIds.some((id) => typeof id !== "string")) {
      return NextResponse.json(
        { error: "orderedTargetIds must be strings" },
        { status: 400 }
      );
    }

    const items = await prisma.adminFolderItem.findMany({
      where: { folderId, targetType },
    });
    const itemByTarget = new Map(items.map((i) => [i.targetId, i]));
    if (
      orderedTargetIds.length !== items.length ||
      orderedTargetIds.some((id) => !itemByTarget.has(id))
    ) {
      return NextResponse.json(
        {
          error:
            "orderedTargetIds must include each item currently in the folder exactly once",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      orderedTargetIds.map((targetId, index) =>
        prisma.adminFolderItem.update({
          where: { id: itemByTarget.get(targetId)!.id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ ok: true });
  }

  // Single move / unfile
  const targetId = (body.targetId || "").trim();
  if (!targetId) {
    return NextResponse.json({ error: "targetId is required" }, { status: 400 });
  }

  if (!("folderId" in body)) {
    return NextResponse.json(
      { error: "folderId is required (null to unfile)" },
      { status: 400 }
    );
  }

  const folderId = body.folderId;

  const valid = await validateFolderTarget(targetType, targetId);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 404 });
  }

  // Unfile
  if (folderId === null) {
    await prisma.adminFolderItem.deleteMany({
      where: { targetType, targetId },
    });
    return NextResponse.json({ ok: true, unfiled: true });
  }

  if (typeof folderId !== "string" || !folderId) {
    return NextResponse.json({ error: "Invalid folderId" }, { status: 400 });
  }

  const folder = await prisma.adminFolder.findUnique({
    where: { id: folderId },
  });
  if (!folder || folder.scope !== targetType) {
    return NextResponse.json(
      { error: "Folder not found for scope" },
      { status: 404 }
    );
  }

  let sortOrder = body.sortOrder;
  if (typeof sortOrder !== "number" || !Number.isFinite(sortOrder)) {
    const max = await prisma.adminFolderItem.aggregate({
      where: { folderId },
      _max: { sortOrder: true },
    });
    sortOrder = (max._max.sortOrder ?? -1) + 1;
  }

  const item = await prisma.adminFolderItem.upsert({
    where: {
      targetType_targetId: { targetType, targetId },
    },
    create: {
      folderId,
      targetType,
      targetId,
      sortOrder,
    },
    update: {
      folderId,
      sortOrder,
    },
  });

  return NextResponse.json({ item });
}
