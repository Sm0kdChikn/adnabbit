import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  requireDeviceAuth,
  remoteViewRelativePath,
  SCREENSHOT_MAX_BYTES,
} from "@/lib/device";
import { UPLOAD_DIR } from "@/lib/uploads";

/**
 * Ticket P / Forge — device uploads a JPEG screenshot (overwrite N=1).
 * Accepts multipart field "image"/"screenshot"/"file", or JSON { imageBase64 }.
 */
export async function POST(req: Request) {
  const auth = await requireDeviceAuth(req);
  if (auth.error) return auth.error;

  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  let jpeg: Buffer | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file =
        (form.get("image") as File | null) ||
        (form.get("screenshot") as File | null) ||
        (form.get("file") as File | null);
      if (!file || typeof file === "string") {
        return NextResponse.json(
          { error: "Missing multipart field image|screenshot|file" },
          { status: 400 }
        );
      }
      const ab = await file.arrayBuffer();
      jpeg = Buffer.from(ab);
    } else if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as {
        imageBase64?: string;
        data?: string;
      } | null;
      const raw = body?.imageBase64 || body?.data;
      if (!raw || typeof raw !== "string") {
        return NextResponse.json(
          { error: "Missing imageBase64" },
          { status: 400 }
        );
      }
      const b64 = raw.replace(/^data:image\/jpeg;base64,/, "");
      jpeg = Buffer.from(b64, "base64");
    } else if (
      contentType.includes("image/jpeg") ||
      contentType.includes("application/octet-stream")
    ) {
      const ab = await req.arrayBuffer();
      jpeg = Buffer.from(ab);
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported Content-Type; use multipart/form-data, application/json, or image/jpeg",
        },
        { status: 415 }
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Failed to read body: ${msg}` },
      { status: 400 }
    );
  }

  if (!jpeg || jpeg.length === 0) {
    return NextResponse.json({ error: "Empty image" }, { status: 400 });
  }
  if (jpeg.length > SCREENSHOT_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Screenshot too large (max ${SCREENSHOT_MAX_BYTES} bytes)`,
      },
      { status: 413 }
    );
  }
  // Soft JPEG magic check (FF D8)
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    return NextResponse.json(
      { error: "Expected JPEG image" },
      { status: 400 }
    );
  }

  const rel = remoteViewRelativePath(auth.device.id);
  const abs = path.join(UPLOAD_DIR, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, jpeg);

  const now = new Date();
  // Re-read epoch in case admin bumped again during capture
  const current = await prisma.device.findUnique({
    where: { id: auth.device.id },
    select: { screenshotEpoch: true },
  });
  const ackEpoch = current?.screenshotEpoch ?? auth.device.screenshotEpoch;

  const updated = await prisma.device.update({
    where: { id: auth.device.id },
    data: {
      remoteViewImagePath: rel,
      remoteViewCapturedAt: now,
      screenshotCapturedEpoch: ackEpoch,
      lastSeenAt: now,
    },
    select: {
      screenshotEpoch: true,
      screenshotCapturedEpoch: true,
      remoteViewCapturedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    capturedAt: updated.remoteViewCapturedAt!.toISOString(),
    screenshotEpoch: updated.screenshotEpoch,
    screenshotCapturedEpoch: updated.screenshotCapturedEpoch,
    bytes: jpeg.length,
  });
}
