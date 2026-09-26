import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const alert = await prisma.fleetAlert.findUnique({ where: { id: params.id } });
  if (!alert) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (alert.status === "RESOLVED") {
    return NextResponse.json({ ok: true, alert });
  }

  const updated = await prisma.fleetAlert.update({
    where: { id: params.id },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  return NextResponse.json({ ok: true, alert: updated });
}
