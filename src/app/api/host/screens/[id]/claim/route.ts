import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHostApi } from "@/lib/host";
import { mintClaimCode } from "@/lib/device";

type Ctx = { params: { id: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findFirst({
    where: { id: params.id, hostId: auth.host.id },
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
