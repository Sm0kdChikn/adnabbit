import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { needsScreenshotCapture, requireDeviceAuth } from "@/lib/device";

export async function POST(req: Request) {
  const auth = await requireDeviceAuth(req);
  if (auth.error) return auth.error;

  const now = new Date();
  const updated = await prisma.device.update({
    where: { id: auth.device.id },
    data: { lastSeenAt: now },
    select: {
      screenId: true,
      playlistEpoch: true,
      screenshotEpoch: true,
      screenshotCapturedEpoch: true,
    },
  });

  const captureScreenshot = needsScreenshotCapture(updated);

  return NextResponse.json({
    ok: true,
    lastSeenAt: now.toISOString(),
    screenId: updated.screenId,
    playlistEpoch: updated.playlistEpoch,
    screenshotEpoch: updated.screenshotEpoch,
    commands: {
      captureScreenshot,
    },
  });
}
