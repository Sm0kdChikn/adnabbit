import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hasPendingInput,
  needsScreenshotCapture,
  requireDeviceAuth,
} from "@/lib/device";
import { resolveOpenHoursForScreen } from "@/lib/open-hours";
import { resolveDownloadHoursForScreen } from "@/lib/download-hours";
import { resolveOfflinePolicyForScreen } from "@/lib/offline-policy";

const PLAYBACK_STATES = new Set(["LIVE", "BLACKOUT", "IDLE", "EMPTY"]);

function parseOptionalInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(v));
  }
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    const n = parseInt(v.trim(), 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

export async function POST(req: Request) {
  const auth = await requireDeviceAuth(req);
  if (auth.error) return auth.error;

  let playbackState: string | null = null;
  let playerVersion: string | undefined;
  let diskFreeBytes: number | undefined;
  let diskTotalBytes: number | undefined;

  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body === "object") {
      if (typeof body.playbackState === "string") {
        const s = body.playbackState.trim().toUpperCase();
        if (PLAYBACK_STATES.has(s)) playbackState = s;
      }
      // Ticket R — player version string (e.g. package.json version)
      if (typeof body.playerVersion === "string") {
        const v = body.playerVersion.trim().slice(0, 64);
        if (v) playerVersion = v;
      }
      // Ticket R — optional disk stats (soft miss; only store if reported)
      const free = parseOptionalInt(body.diskFreeBytes);
      const total = parseOptionalInt(body.diskTotalBytes);
      if (free !== undefined) diskFreeBytes = free;
      if (total !== undefined) diskTotalBytes = total;
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
      ...(playerVersion !== undefined ? { playerVersion } : {}),
      ...(diskFreeBytes !== undefined ? { diskFreeBytes } : {}),
      ...(diskTotalBytes !== undefined ? { diskTotalBytes } : {}),
    },
    select: {
      screenId: true,
      playlistEpoch: true,
      screenshotEpoch: true,
      screenshotCapturedEpoch: true,
      pendingInputJson: true,
      playbackState: true,
      playerVersion: true,
      diskFreeBytes: true,
      diskTotalBytes: true,
    },
  });

  const [hours, downloadHours, offlinePolicy] = await Promise.all([
    resolveOpenHoursForScreen(updated.screenId, now),
    resolveDownloadHoursForScreen(updated.screenId, now),
    resolveOfflinePolicyForScreen(updated.screenId),
  ]);
  const captureScreenshot = needsScreenshotCapture(updated);
  const inputPending = hasPendingInput(updated.pendingInputJson);

  return NextResponse.json({
    ok: true,
    lastSeenAt: now.toISOString(),
    screenId: updated.screenId,
    playlistEpoch: updated.playlistEpoch,
    screenshotEpoch: updated.screenshotEpoch,
    playbackState: updated.playbackState,
    playerVersion: updated.playerVersion,
    hours,
    downloadHours,
    downloadAllowed: downloadHours.downloadAllowed,
    playbackAllowed: hours.isOpenNow,
    // Ticket V
    offlinePolicy: offlinePolicy.offlinePolicy,
    offlineCacheTtlHours: offlinePolicy.offlineCacheTtlHours,
    commands: {
      captureScreenshot,
      inputPending,
    },
  });
}

