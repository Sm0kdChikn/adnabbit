import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import {
  isDeviceRecentlySeen,
  PLAYER_ONLINE_GRACE_MS,
  needsScreenshotCapture,
} from "@/lib/device";
import { UPLOAD_DIR } from "@/lib/uploads";

type Ctx = { params: { id: string } };

/** Consider an uploaded preview "fresh" for ~2 minutes (skip re-request if still current). */
const FRESH_IMAGE_MS = 2 * 60 * 1000;

function imageUrlForScreen(screenId: string): string {
  return `/api/admin/screens/${screenId}/remote-view`;
}

/**
 * Ticket P — admin requests on-demand screenshot capture (epoch bump).
 * Returns ready+imageUrl if a fresh capture already exists; otherwise { status: 'requested' }.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      device: {
        select: {
          id: true,
          lastSeenAt: true,
          screenshotEpoch: true,
          screenshotCapturedEpoch: true,
          remoteViewImagePath: true,
          remoteViewCapturedAt: true,
        },
      },
    },
  });
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }
  if (!screen.device) {
    return NextResponse.json(
      { error: "No device paired to this screen" },
      { status: 409 }
    );
  }
  if (!isDeviceRecentlySeen(screen.device.lastSeenAt)) {
    const graceMin = Math.round(PLAYER_ONLINE_GRACE_MS / 60_000);
    return NextResponse.json(
      {
        error: `Player appears offline (no heartbeat within ~${graceMin} min). Cannot request remote view.`,
      },
      { status: 409 }
    );
  }

  const now = new Date();
  const capturedAt = screen.device.remoteViewCapturedAt;
  const hasFresh =
    !!screen.device.remoteViewImagePath &&
    !!capturedAt &&
    now.getTime() - capturedAt.getTime() <= FRESH_IMAGE_MS &&
    !needsScreenshotCapture(screen.device);

  if (hasFresh) {
    return NextResponse.json({
      ok: true,
      status: "ready" as const,
      imageUrl: imageUrlForScreen(screen.id),
      capturedAt: capturedAt!.toISOString(),
      screenshotEpoch: screen.device.screenshotEpoch,
    });
  }

  const updated = await prisma.device.update({
    where: { id: screen.device.id },
    data: { screenshotEpoch: { increment: 1 } },
    select: { screenshotEpoch: true },
  });

  return NextResponse.json({
    ok: true,
    status: "requested" as const,
    screenshotEpoch: updated.screenshotEpoch,
  });
}

/**
 * Ticket P — serve latest auth'd screenshot JPEG (admin session only).
 * 202 if capture pending / no image yet; 404 if never captured.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      device: {
        select: {
          remoteViewImagePath: true,
          remoteViewCapturedAt: true,
          screenshotEpoch: true,
          screenshotCapturedEpoch: true,
        },
      },
    },
  });
  if (!screen) {
    return NextResponse.json({ error: "Screen not found" }, { status: 404 });
  }
  if (!screen.device) {
    return NextResponse.json(
      { error: "No device paired to this screen" },
      { status: 409 }
    );
  }

  const pending = needsScreenshotCapture(screen.device);
  const rel = screen.device.remoteViewImagePath;
  if (!rel) {
    if (pending) {
      return NextResponse.json(
        { ok: false, status: "pending", error: "Capture pending" },
        { status: 202 }
      );
    }
    return NextResponse.json({ error: "No screenshot yet" }, { status: 404 });
  }

  const abs = path.join(UPLOAD_DIR, rel);
  // Reject path traversal
  if (!abs.startsWith(UPLOAD_DIR) || rel.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const data = await readFile(abs);
    if (pending) {
      // Stale image while waiting for a newer capture — still return bytes with pending hint
      return new NextResponse(data, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, no-store, max-age=0",
          "X-Remote-View-Status": "pending",
          "X-Remote-View-Captured-At":
            screen.device.remoteViewCapturedAt?.toISOString() ?? "",
        },
      });
    }
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Remote-View-Status": "ready",
        "X-Remote-View-Captured-At":
          screen.device.remoteViewCapturedAt?.toISOString() ?? "",
      },
    });
  } catch {
    if (pending) {
      return NextResponse.json(
        { ok: false, status: "pending", error: "Capture pending" },
        { status: 202 }
      );
    }
    return NextResponse.json({ error: "Screenshot file missing" }, { status: 404 });
  }
}
