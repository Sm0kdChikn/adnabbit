import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHostApi } from "@/lib/host";
import { isHostVertical } from "@/lib/types";
import { isValidTimeZone } from "@/lib/schedules";
import {
  isOfflinePolicy,
  normalizeOfflineCacheTtlHours,
} from "@/lib/offline-policy";

export async function GET() {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const host = await prisma.host.findUnique({
    where: { id: auth.host.id },
    include: {
      screens: { orderBy: { name: "asc" } },
      _count: { select: { screens: true } },
    },
  });
  return NextResponse.json({ host });
}

export async function PATCH(req: Request) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  let body: {
    name?: string;
    vertical?: string;
    otherLabel?: string | null;
    notes?: string | null;
    timezone?: string;
    offlinePolicy?: string;
    offlineCacheTtlHours?: number | string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = auth.host;
  const name = body.name !== undefined ? body.name.trim() : existing.name;
  const vertical =
    body.vertical !== undefined ? body.vertical.trim() : existing.vertical;
  let otherLabel =
    body.otherLabel !== undefined
      ? body.otherLabel?.trim() || null
      : existing.otherLabel;
  const notes =
    body.notes !== undefined ? body.notes?.trim() || null : existing.notes;
  const timezone =
    body.timezone !== undefined
      ? body.timezone.trim() || "America/Denver"
      : existing.timezone;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!isHostVertical(vertical)) {
    return NextResponse.json({ error: "Invalid vertical" }, { status: 400 });
  }
  if (vertical === "OTHER" && !otherLabel) {
    return NextResponse.json(
      { error: "otherLabel is required when vertical is OTHER" },
      { status: 400 }
    );
  }
  if (vertical !== "OTHER") {
    otherLabel = null;
  }
  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "Invalid IANA timezone" }, { status: 400 });
  }

  let offlinePolicy = existing.offlinePolicy;
  if (body.offlinePolicy !== undefined) {
    if (!isOfflinePolicy(body.offlinePolicy)) {
      return NextResponse.json(
        { error: "offlinePolicy must be PLAY_CACHE or BLACKOUT" },
        { status: 400 }
      );
    }
    offlinePolicy = body.offlinePolicy;
  }

  let offlineCacheTtlHours = existing.offlineCacheTtlHours;
  if (body.offlineCacheTtlHours !== undefined) {
    const ttl = normalizeOfflineCacheTtlHours(body.offlineCacheTtlHours);
    if (ttl === null) {
      return NextResponse.json(
        { error: "offlineCacheTtlHours must be an integer 0–8760" },
        { status: 400 }
      );
    }
    offlineCacheTtlHours = ttl;
  }

  const host = await prisma.host.update({
    where: { id: existing.id },
    data: {
      name,
      vertical,
      otherLabel,
      notes,
      timezone,
      offlinePolicy,
      offlineCacheTtlHours,
    },
  });

  return NextResponse.json({ host });
}
