import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDeviceAuth } from "@/lib/device";

export async function POST(req: Request) {
  const auth = await requireDeviceAuth(req);
  if (auth.error) return auth.error;

  const now = new Date();
  await prisma.device.update({
    where: { id: auth.device.id },
    data: { lastSeenAt: now },
  });

  return NextResponse.json({
    ok: true,
    lastSeenAt: now.toISOString(),
    screenId: auth.device.screenId,
  });
}
