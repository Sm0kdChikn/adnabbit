import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

type Ctx = { params: { id: string } };

/** Detach owning user from Host (set userId null). Does not delete the User. */
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const host = await prisma.host.findUnique({ where: { id: params.id } });
  if (!host) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.host.update({
    where: { id: host.id },
    data: { userId: null },
  });

  return NextResponse.json({ host: updated, ok: true });
}
