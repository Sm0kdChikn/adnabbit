import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hasPendingInput,
  parsePendingInputJson,
  requireDeviceAuth,
} from "@/lib/device";

/**
 * Ticket P.1 — device drains pending remote-control events (atomic clear).
 * Prefer polling this every ~2s; heartbeat also signals commands.inputPending.
 */
export async function POST(req: Request) {
  const auth = await requireDeviceAuth(req);
  if (auth.error) return auth.error;

  const now = new Date();

  // Read-then-clear. Concurrent admin append may race; MVP accepts rare loss.
  const device = await prisma.device.findUnique({
    where: { id: auth.device.id },
    select: { pendingInputJson: true },
  });

  const events = parsePendingInputJson(device?.pendingInputJson);
  const hadPending = hasPendingInput(device?.pendingInputJson);

  await prisma.device.update({
    where: { id: auth.device.id },
    data: {
      lastSeenAt: now,
      ...(hadPending ? { pendingInputJson: null } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    events,
    drainedAt: now.toISOString(),
  });
}
