import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { isAdminFolderScope } from "@/lib/types";

/** GET /api/admin/folders?scope=HOST|ADVERTISER */
export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const scope = new URL(req.url).searchParams.get("scope") || "";
  if (!isAdminFolderScope(scope)) {
    return NextResponse.json(
      { error: "scope must be HOST or ADVERTISER" },
      { status: 400 }
    );
  }

  const folders = await prisma.adminFolder.findMany({
    where: { scope },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });

  return NextResponse.json({ folders });
}

/** POST /api/admin/folders — create folder */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { scope?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scope = (body.scope || "").trim();
  const name = (body.name || "").trim();

  if (!isAdminFolderScope(scope)) {
    return NextResponse.json(
      { error: "scope must be HOST or ADVERTISER" },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const max = await prisma.adminFolder.aggregate({
    where: { scope },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;

  const folder = await prisma.adminFolder.create({
    data: { scope, name, sortOrder },
    include: { items: true },
  });

  return NextResponse.json({ folder }, { status: 201 });
}
