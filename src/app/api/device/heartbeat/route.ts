import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hasPendingInput,
  needsScreenshotCapture,
  requireDeviceAuth,
} from "@/lib/device";
import { resolveOpenHoursForScreen } from "@/lib/open-hours";

const PLAYBACK_STATES = new Set(["LIVE", "BLACKOUT", "IDLE", "EMPTY"]);

export async function POST(req: Request) {
  const auth = await requireDeviceAuth(req);
  if (auth.error) return auth.error;

  let playbackState: string | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.playbackState === "string") {
      const s = body.playbackState.trim().toUpperCase();
      if (PLAYBACK_STATES.has(s)) playbackState = s;
    }
  } catch {
    /* body optional */
  }

  const now = new Date();
  const updated = await prisma.device.update({
    where: { id: auth.device.id },
    data: {
      lastSeenAt: now,
      ...(playbackState
        ? { playbackState, playbackStateAt: now }
        : {}),
    },
    select: {
      screenId: true,
      playlistEpoch: true,
      screenshotEpoch: true,
      screenshotCapturedEpoch: true,
      pendingInputJson: true,
      playbackState: true,
    },
  });

  const hours = await resolveOpenHoursForScreen(updated.screenId, now);
  const captureScreenshot = needsScreenshotCapture(updated);
  const inputPending = hasPendingInput(updated.pendingInputJson);

  return NextResponse.json({
    ok: true,
    lastSeenAt: now.toISOString(),
    screenId: updated.screenId,
    playlistEpoch: updated.playlistEpoch,
    screenshotEpoch: updated.screenshotEpoch,
    playbackState: updated.playbackState,
    hours,
    commands: {
      captureScreenshot,
      inputPending,
    },
  });
}
