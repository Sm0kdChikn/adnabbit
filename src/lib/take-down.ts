/**
 * Ticket S — emergency take-down stamps + playlist epoch bumps.
 * Campaign windows reuse Schedule start/end (Ticket E); see scheduleWindowPhase.
 */
import { prisma } from "./prisma";
import {
  DEFAULT_TIMEZONE,
  todayYmdInZone,
  ymdCompare,
} from "./schedules";

export type TakeDownTarget =
  | "creative"
  | "advertiser"
  | "host"
  | "screen";

/** Bump playlistEpoch for every Device paired to the given screens (no online check). */
export async function bumpPlaylistEpochForScreens(
  screenIds: string[]
): Promise<number> {
  const ids = Array.from(new Set(screenIds.filter(Boolean)));
  if (ids.length === 0) return 0;
  const result = await prisma.device.updateMany({
    where: { screenId: { in: ids } },
    data: { playlistEpoch: { increment: 1 } },
  });
  return result.count;
}

/** Screens that currently have ACTIVE schedules for this creative. */
export async function screenIdsForCreative(creativeId: string): Promise<string[]> {
  const rows = await prisma.schedule.findMany({
    where: {
      status: "ACTIVE",
      placement: { creativeId },
    },
    select: { screenId: true },
    distinct: ["screenId"],
  });
  return rows.map((r) => r.screenId);
}

/** Screens with ACTIVE schedules for any creative owned by this advertiser. */
export async function screenIdsForAdvertiser(
  advertiserId: string
): Promise<string[]> {
  const rows = await prisma.schedule.findMany({
    where: {
      status: "ACTIVE",
      placement: { advertiserId },
    },
    select: { screenId: true },
    distinct: ["screenId"],
  });
  return rows.map((r) => r.screenId);
}

export async function screenIdsForHost(hostId: string): Promise<string[]> {
  const rows = await prisma.screen.findMany({
    where: { hostId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export type TakeDownResult = {
  ok: true;
  takenDown: boolean;
  affectedDevices: number;
  takenDownAt: string | null;
  reason: string | null;
};

export async function takeDownCreative(opts: {
  creativeId: string;
  adminId: string;
  reason?: string | null;
  undo?: boolean;
}): Promise<TakeDownResult | { error: string; status: number }> {
  const creative = await prisma.creative.findUnique({
    where: { id: opts.creativeId },
    select: { id: true, takenDownAt: true },
  });
  if (!creative) return { error: "Creative not found", status: 404 };

  const undo = !!opts.undo;
  if (undo && !creative.takenDownAt) {
    return { error: "Creative is not taken down", status: 409 };
  }
  if (!undo && creative.takenDownAt) {
    return { error: "Creative is already taken down", status: 409 };
  }

  const reason = opts.reason?.trim() || null;
  const updated = await prisma.creative.update({
    where: { id: opts.creativeId },
    data: undo
      ? { takenDownAt: null, takenDownById: null, takenDownReason: null }
      : {
          takenDownAt: new Date(),
          takenDownById: opts.adminId,
          takenDownReason: reason,
        },
    select: { takenDownAt: true, takenDownReason: true },
  });

  const screens = await screenIdsForCreative(opts.creativeId);
  const affectedDevices = await bumpPlaylistEpochForScreens(screens);

  return {
    ok: true,
    takenDown: !undo,
    affectedDevices,
    takenDownAt: updated.takenDownAt?.toISOString() ?? null,
    reason: updated.takenDownReason,
  };
}

export async function takeDownAdvertiser(opts: {
  advertiserId: string;
  adminId: string;
  reason?: string | null;
  undo?: boolean;
}): Promise<TakeDownResult | { error: string; status: number }> {
  const user = await prisma.user.findUnique({
    where: { id: opts.advertiserId },
    select: {
      id: true,
      role: true,
      advertiserTakenDownAt: true,
    },
  });
  if (!user || user.role !== "ADVERTISER") {
    return { error: "Advertiser not found", status: 404 };
  }

  const undo = !!opts.undo;
  if (undo && !user.advertiserTakenDownAt) {
    return { error: "Advertiser is not taken down", status: 409 };
  }
  if (!undo && user.advertiserTakenDownAt) {
    return { error: "Advertiser is already taken down", status: 409 };
  }

  const reason = opts.reason?.trim() || null;
  const updated = await prisma.user.update({
    where: { id: opts.advertiserId },
    data: undo
      ? {
          advertiserTakenDownAt: null,
          advertiserTakenDownById: null,
          advertiserTakenDownReason: null,
        }
      : {
          advertiserTakenDownAt: new Date(),
          advertiserTakenDownById: opts.adminId,
          advertiserTakenDownReason: reason,
        },
    select: {
      advertiserTakenDownAt: true,
      advertiserTakenDownReason: true,
    },
  });

  const screens = await screenIdsForAdvertiser(opts.advertiserId);
  const affectedDevices = await bumpPlaylistEpochForScreens(screens);

  return {
    ok: true,
    takenDown: !undo,
    affectedDevices,
    takenDownAt: updated.advertiserTakenDownAt?.toISOString() ?? null,
    reason: updated.advertiserTakenDownReason,
  };
}

export async function takeDownHostPlayback(opts: {
  hostId: string;
  adminId: string;
  reason?: string | null;
  undo?: boolean;
}): Promise<TakeDownResult | { error: string; status: number }> {
  const host = await prisma.host.findUnique({
    where: { id: opts.hostId },
    select: { id: true, playbackTakenDownAt: true },
  });
  if (!host) return { error: "Host not found", status: 404 };

  const undo = !!opts.undo;
  if (undo && !host.playbackTakenDownAt) {
    return { error: "Host playback is not taken down", status: 409 };
  }
  if (!undo && host.playbackTakenDownAt) {
    return { error: "Host playback is already taken down", status: 409 };
  }

  const reason = opts.reason?.trim() || null;
  const updated = await prisma.host.update({
    where: { id: opts.hostId },
    data: undo
      ? {
          playbackTakenDownAt: null,
          playbackTakenDownById: null,
          playbackTakenDownReason: null,
        }
      : {
          playbackTakenDownAt: new Date(),
          playbackTakenDownById: opts.adminId,
          playbackTakenDownReason: reason,
        },
    select: { playbackTakenDownAt: true, playbackTakenDownReason: true },
  });

  const screens = await screenIdsForHost(opts.hostId);
  const affectedDevices = await bumpPlaylistEpochForScreens(screens);

  return {
    ok: true,
    takenDown: !undo,
    affectedDevices,
    takenDownAt: updated.playbackTakenDownAt?.toISOString() ?? null,
    reason: updated.playbackTakenDownReason,
  };
}

export async function takeDownScreenPlayback(opts: {
  screenId: string;
  adminId: string;
  reason?: string | null;
  undo?: boolean;
}): Promise<TakeDownResult | { error: string; status: number }> {
  const screen = await prisma.screen.findUnique({
    where: { id: opts.screenId },
    select: { id: true, playbackTakenDownAt: true },
  });
  if (!screen) return { error: "Screen not found", status: 404 };

  const undo = !!opts.undo;
  if (undo && !screen.playbackTakenDownAt) {
    return { error: "Screen playback is not taken down", status: 409 };
  }
  if (!undo && screen.playbackTakenDownAt) {
    return { error: "Screen playback is already taken down", status: 409 };
  }

  const reason = opts.reason?.trim() || null;
  const updated = await prisma.screen.update({
    where: { id: opts.screenId },
    data: undo
      ? {
          playbackTakenDownAt: null,
          playbackTakenDownById: null,
          playbackTakenDownReason: null,
        }
      : {
          playbackTakenDownAt: new Date(),
          playbackTakenDownById: opts.adminId,
          playbackTakenDownReason: reason,
        },
    select: { playbackTakenDownAt: true, playbackTakenDownReason: true },
  });

  const affectedDevices = await bumpPlaylistEpochForScreens([opts.screenId]);

  return {
    ok: true,
    takenDown: !undo,
    affectedDevices,
    takenDownAt: updated.playbackTakenDownAt?.toISOString() ?? null,
    reason: updated.playbackTakenDownReason,
  };
}

/** Campaign window phase for UI badges (Schedule Ticket E fields). */
export type WindowPhase = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "DRAFT" | "CANCELLED";

export function scheduleWindowPhase(
  s: {
    status: string;
    kind: string;
    startAt: Date | null;
    endAt: Date | null;
    campaignStartDate: string | null;
    campaignEndDate: string | null;
  },
  timeZone: string = DEFAULT_TIMEZONE,
  now: Date = new Date()
): WindowPhase {
  if (s.status === "DRAFT") return "DRAFT";
  if (s.status === "CANCELLED") return "CANCELLED";
  if (s.status === "ENDED") return "EXPIRED";

  // ACTIVE
  if (s.kind === "RECURRING") {
    const today = todayYmdInZone(timeZone, now);
    if (s.campaignStartDate && ymdCompare(today, s.campaignStartDate) < 0) {
      return "SCHEDULED";
    }
    if (s.campaignEndDate && ymdCompare(today, s.campaignEndDate) > 0) {
      return "EXPIRED";
    }
    return "ACTIVE";
  }

  if (s.startAt && now < s.startAt) return "SCHEDULED";
  if (s.endAt && now >= s.endAt) return "EXPIRED";
  return "ACTIVE";
}
