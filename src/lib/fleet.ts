/**
 * Ticket R — fleet health + offline/empty alerts (admin).
 * Online = lastSeenAt within PLAYER_ONLINE_GRACE_MS (5m).
 * Empty = playbackAllowed (open hours / force-live) AND 0 active playlist items.
 * CLOSED_HOURS is never Offline/Empty fault — blackout is separate.
 */
import { prisma } from "./prisma";
import {
  isDeviceRecentlySeen,
  PLAYER_ONLINE_GRACE_MS,
} from "./device";
import {
  deriveDeviceDisplayStatus,
  resolveOpenHoursForScreen,
  type DeviceDisplayStatus,
  type OpenHoursPayload,
} from "./open-hours";
import { buildPlaylistForScreen } from "./playlist";

export const FLEET_ALERT_KINDS = ["OFFLINE", "EMPTY"] as const;
export type FleetAlertKind = (typeof FLEET_ALERT_KINDS)[number];

export const FLEET_ALERT_STATUSES = ["OPEN", "RESOLVED"] as const;
export type FleetAlertStatus = (typeof FLEET_ALERT_STATUSES)[number];

/** Soft-miss: optional env pin for "latest" player (no release API). */
export function latestKnownPlayerVersion(): string | null {
  const v = process.env.ADNNABIT_LATEST_PLAYER_VERSION?.trim();
  return v || null;
}

/** Disk pressure threshold when stats are reported (soft miss). */
export const DISK_CRITICAL_FREE_RATIO = 0.05;

export type FleetScreenHealth = {
  screenId: string;
  screenName: string;
  city: string;
  zip: string;
  hostId: string;
  hostName: string;
  deviceId: string | null;
  paired: boolean;
  online: boolean;
  lastSeenAt: string | null;
  /** hours.isOpenNow — playbackAllowed gate */
  playbackAllowed: boolean;
  hoursReason: OpenHoursPayload["reason"];
  forceLiveActive: boolean;
  playbackState: string | null;
  displayStatus: DeviceDisplayStatus;
  activeItemCount: number;
  emptyPlaylist: boolean;
  playerVersion: string | null;
  /** missing | ok | lag | unknown — soft miss for lag vs env pin */
  versionStatus: "missing" | "ok" | "lag" | "unknown";
  diskFreeBytes: number | null;
  diskTotalBytes: number | null;
  /** null when disk not reported */
  diskCritical: boolean | null;
  attention: boolean;
  openAlertKinds: FleetAlertKind[];
  /** Ticket V — host offline play policy (soft miss: per-screen). */
  offlinePolicy: "PLAY_CACHE" | "BLACKOUT";
  offlineCacheTtlHours: number;
  /** Best-effort: offline + PLAY_CACHE + ttl>0 → may still be looping cache. */
  mayPlayCache: boolean;
};

export function countActiveItemsNow(
  items: { startAt: string; endAt: string }[],
  now = new Date()
): number {
  const t = now.getTime();
  let n = 0;
  for (const it of items) {
    const s = Date.parse(it.startAt);
    const e = Date.parse(it.endAt);
    if (Number.isFinite(s) && Number.isFinite(e) && s <= t && t < e) n++;
  }
  return n;
}

function compareSemverLoose(a: string, b: string): number | null {
  const pa = a.replace(/^v/i, "").split(/[.+-]/).map((x) => parseInt(x, 10));
  const pb = b.replace(/^v/i, "").split(/[.+-]/).map((x) => parseInt(x, 10));
  if (!pa.length || !pb.length || pa.some((x) => !Number.isFinite(x)) || pb.some((x) => !Number.isFinite(x))) {
    return null;
  }
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

export function deriveVersionStatus(
  playerVersion: string | null | undefined,
  latest = latestKnownPlayerVersion()
): FleetScreenHealth["versionStatus"] {
  if (!playerVersion?.trim()) return "missing";
  if (!latest) return "unknown";
  const cmp = compareSemverLoose(playerVersion.trim(), latest);
  if (cmp === null) return "unknown";
  if (cmp < 0) return "lag";
  return "ok";
}

export function deriveDiskCritical(
  free: number | null | undefined,
  total: number | null | undefined
): boolean | null {
  if (free == null || total == null || total <= 0) return null;
  return free / total < DISK_CRITICAL_FREE_RATIO;
}

/**
 * Compute health for all paired screens (or every screen with optional unpaired).
 * Uses playlist builder for active-now count (same source as device playlist API).
 */
export async function listFleetHealth(opts?: {
  now?: Date;
  /** Include unpaired screens (default false — board is paired devices). */
  includeUnpaired?: boolean;
  apiBase?: string;
}): Promise<FleetScreenHealth[]> {
  const now = opts?.now ?? new Date();
  const includeUnpaired = opts?.includeUnpaired ?? false;
  const apiBase = opts?.apiBase || process.env.NEXTAUTH_URL || "http://127.0.0.1:3000";

  const screens = await prisma.screen.findMany({
    where: includeUnpaired ? undefined : { device: { isNot: null } },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    include: {
      host: {
        select: {
          id: true,
          name: true,
          offlinePolicy: true,
          offlineCacheTtlHours: true,
        },
      },
      device: true,
      fleetAlerts: {
        where: { status: "OPEN" },
        select: { kind: true },
      },
    },
  });

  const out: FleetScreenHealth[] = [];

  for (const screen of screens) {
    const hours = await resolveOpenHoursForScreen(screen.id, now);
    const device = screen.device;
    const online = isDeviceRecentlySeen(device?.lastSeenAt, now);
    const playbackAllowed = hours.isOpenNow;

    let activeItemCount = 0;
    if (device) {
      const playlist = await buildPlaylistForScreen({
        screenId: screen.id,
        apiBase,
        now,
        windowHours: 24,
      });
      activeItemCount = countActiveItemsNow(playlist.items, now);
    }

    // Empty only when playback allowed (open / force-live). Never during CLOSED_HOURS.
    const emptyPlaylist =
      !!device && online && playbackAllowed && activeItemCount === 0;

    const displayStatus = deriveDeviceDisplayStatus({
      hasDevice: !!device,
      online,
      hours,
      playbackState: device?.playbackState,
    });

    const playerVersion = device?.playerVersion ?? null;
    const versionStatus = deriveVersionStatus(playerVersion);
    const diskFreeBytes = device?.diskFreeBytes ?? null;
    const diskTotalBytes = device?.diskTotalBytes ?? null;
    const diskCritical = deriveDiskCritical(diskFreeBytes, diskTotalBytes);

    const openAlertKinds = (screen.fleetAlerts || [])
      .map((a) => a.kind)
      .filter((k): k is FleetAlertKind =>
        (FLEET_ALERT_KINDS as readonly string[]).includes(k)
      );

    const offlinePolicy =
      screen.host.offlinePolicy === "BLACKOUT" ? "BLACKOUT" : "PLAY_CACHE";
    const offlineCacheTtlHours =
      typeof screen.host.offlineCacheTtlHours === "number"
        ? screen.host.offlineCacheTtlHours
        : 24;
    const mayPlayCache =
      !!device && !online && offlinePolicy === "PLAY_CACHE" && offlineCacheTtlHours > 0;

    const attention =
      !online ||
      emptyPlaylist ||
      versionStatus === "missing" ||
      versionStatus === "lag" ||
      diskCritical === true;

    out.push({
      screenId: screen.id,
      screenName: screen.name,
      city: screen.city,
      zip: screen.zip,
      hostId: screen.host.id,
      hostName: screen.host.name,
      deviceId: device?.id ?? null,
      paired: !!device,
      online,
      lastSeenAt: device?.lastSeenAt?.toISOString() ?? null,
      playbackAllowed,
      hoursReason: hours.reason,
      forceLiveActive: hours.forceLiveActive,
      playbackState: device?.playbackState ?? null,
      displayStatus,
      activeItemCount,
      emptyPlaylist,
      playerVersion,
      versionStatus,
      diskFreeBytes,
      diskTotalBytes,
      diskCritical,
      attention,
      openAlertKinds,
      offlinePolicy,
      offlineCacheTtlHours,
      mayPlayCache,
    });
  }

  return out;
}

export type FleetScanResult = {
  created: number;
  resolved: number;
  openCount: number;
  graceMs: number;
};

/**
 * Persist OFFLINE / EMPTY alerts with dedupe: one OPEN per (screen, kind).
 * Resolves when condition clears. CLOSED_HOURS never opens EMPTY.
 */
export async function scanFleetAlerts(opts?: {
  now?: Date;
  apiBase?: string;
}): Promise<FleetScanResult> {
  const now = opts?.now ?? new Date();
  const health = await listFleetHealth({
    now,
    includeUnpaired: false,
    apiBase: opts?.apiBase,
  });

  let created = 0;
  let resolved = 0;

  for (const row of health) {
    const wantOffline = row.paired && !row.online;
    const wantEmpty = row.emptyPlaylist;

    for (const kind of FLEET_ALERT_KINDS) {
      const shouldOpen =
        kind === "OFFLINE" ? wantOffline : kind === "EMPTY" ? wantEmpty : false;

      const existing = await prisma.fleetAlert.findFirst({
        where: { screenId: row.screenId, kind, status: "OPEN" },
      });

      if (shouldOpen && !existing) {
        const message =
          kind === "OFFLINE"
            ? `No heartbeat within ${PLAYER_ONLINE_GRACE_MS / 60000} min (last seen ${row.lastSeenAt || "never"})`
            : `Open hours but 0 active playlist items`;
        await prisma.fleetAlert.create({
          data: {
            screenId: row.screenId,
            kind,
            status: "OPEN",
            message,
            openedAt: now,
          },
        });
        created++;
      } else if (!shouldOpen && existing) {
        await prisma.fleetAlert.update({
          where: { id: existing.id },
          data: { status: "RESOLVED", resolvedAt: now },
        });
        resolved++;
      }
    }
  }

  const openCount = await prisma.fleetAlert.count({ where: { status: "OPEN" } });

  return {
    created,
    resolved,
    openCount,
    graceMs: PLAYER_ONLINE_GRACE_MS,
  };
}

export async function listFleetAlerts(opts?: {
  status?: FleetAlertStatus | "ALL";
  kind?: FleetAlertKind;
  limit?: number;
}) {
  const status = opts?.status ?? "OPEN";
  const limit = Math.min(200, Math.max(1, opts?.limit ?? 50));
  return prisma.fleetAlert.findMany({
    where: {
      ...(status !== "ALL" ? { status } : {}),
      ...(opts?.kind ? { kind: opts.kind } : {}),
    },
    orderBy: [{ status: "asc" }, { openedAt: "desc" }],
    take: limit,
    include: {
      screen: {
        select: {
          id: true,
          name: true,
          city: true,
          host: {
            select: {
              id: true,
              name: true,
              offlinePolicy: true,
              offlineCacheTtlHours: true,
            },
          },
          device: {
            select: {
              lastSeenAt: true,
              playbackState: true,
              playerVersion: true,
            },
          },
        },
      },
    },
  });
}

export async function countOpenFleetAlerts(): Promise<number> {
  return prisma.fleetAlert.count({ where: { status: "OPEN" } });
}
