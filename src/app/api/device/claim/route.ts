import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  generateDeviceToken,
  hashDeviceToken,
  isValidClaimCodeFormat,
  normalizeClaimCode,
} from "@/lib/device";
import { DEFAULT_TIMEZONE } from "@/lib/schedules";
import { resolveOpenHoursForScreen } from "@/lib/open-hours";
import { resolveDownloadHoursForScreen } from "@/lib/download-hours";

const bodySchema = z.object({
  code: z.string().min(1),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const code = normalizeClaimCode(parsed.data.code);
  if (!isValidClaimCodeFormat(code)) {
    return NextResponse.json(
      { error: "Invalid claim code format" },
      { status: 400 }
    );
  }

  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.screenClaim.findUnique({
        where: { code },
        include: {
          screen: {
            include: {
              host: { select: { name: true, timezone: true } },
            },
          },
        },
      });
      if (!claim || claim.usedAt || claim.expiresAt <= now) {
        return { error: "Invalid or expired claim code" as const };
      }

      await tx.screenClaim.update({
        where: { id: claim.id },
        data: { usedAt: now },
      });

      const token = generateDeviceToken();
      const tokenHash = hashDeviceToken(token);

      // Reclaim may replace prior device for this screen (spike)
      await tx.device.deleteMany({ where: { screenId: claim.screenId } });

      const device = await tx.device.create({
        data: {
          screenId: claim.screenId,
          tokenHash,
          name: `Player ${claim.screen.name}`,
          lastSeenAt: now,
          claimedAt: now,
        },
      });

      return {
        deviceToken: token,
        screenId: claim.screenId,
        screenName: claim.screen.name,
        hostName: claim.screen.host.name,
        timezone: claim.screen.host.timezone || DEFAULT_TIMEZONE,
        deviceId: device.id,
      };
    });

    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const claimed = result as {
      deviceToken: string;
      screenId: string;
      screenName: string;
      hostName: string;
      timezone: string;
      deviceId: string;
    };
    const hours = await resolveOpenHoursForScreen(claimed.screenId);
    const downloadHours = await resolveDownloadHoursForScreen(claimed.screenId);
    return NextResponse.json({
      deviceToken: claimed.deviceToken,
      screenId: claimed.screenId,
      screenName: claimed.screenName,
      hostName: claimed.hostName,
      timezone: claimed.timezone,
      hours,
      downloadHours,
      downloadAllowed: downloadHours.downloadAllowed,
      playbackAllowed: hours.isOpenNow,
    });
  } catch (e) {
    console.error("device claim failed", e);
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }
}
