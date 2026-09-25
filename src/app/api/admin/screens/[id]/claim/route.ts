import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { mintClaimCode } from "@/lib/device";

type Ctx = { params: { id: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }

  const claim = await mintClaimCode({
    screenId: screen.id,
    createdById: auth.user.id,
  });

  return NextResponse.json({
    code: claim.code,
    expiresAt: claim.expiresAt.toISOString(),
    screenId: screen.id,
    screenName: screen.name,
  });
}
