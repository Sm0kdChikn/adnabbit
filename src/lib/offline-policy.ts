/**
 * Ticket V — offline play policy (host-level).
 * PLAY_CACHE (default): loop last good playlist while cache age ≤ TTL.
 * BLACKOUT: soft blackout immediately when offline / no heartbeat within grace.
 * offlineCacheTtlHours: 0 = blackout immediately even under PLAY_CACHE.
 * Soft miss: per-screen override.
 */
import { prisma } from "./prisma";

export const OFFLINE_POLICIES = ["PLAY_CACHE", "BLACKOUT"] as const;
export type OfflinePolicy = (typeof OFFLINE_POLICIES)[number];

export const DEFAULT_OFFLINE_POLICY: OfflinePolicy = "PLAY_CACHE";
export const DEFAULT_OFFLINE_CACHE_TTL_HOURS = 24;

export type OfflinePolicyPayload = {
  offlinePolicy: OfflinePolicy;
  offlineCacheTtlHours: number;
  /** Soft miss note for clients. */
  perScreenOverride: false;
};

export function isOfflinePolicy(v: unknown): v is OfflinePolicy {
  return (
    typeof v === "string" &&
    (OFFLINE_POLICIES as readonly string[]).includes(v)
  );
}

/** Clamp TTL to 0..8760 (1 year). */
export function normalizeOfflineCacheTtlHours(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.floor(raw);
    if (n < 0 || n > 8760) return null;
    return n;
  }
  if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) {
    const n = parseInt(raw.trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 8760) return null;
    return n;
  }
  return null;
}

export function toOfflinePolicyPayload(host: {
  offlinePolicy?: string | null;
  offlineCacheTtlHours?: number | null;
}): OfflinePolicyPayload {
  const policy = isOfflinePolicy(host.offlinePolicy)
    ? host.offlinePolicy
    : DEFAULT_OFFLINE_POLICY;
  const ttl =
    typeof host.offlineCacheTtlHours === "number" &&
    Number.isFinite(host.offlineCacheTtlHours) &&
    host.offlineCacheTtlHours >= 0
      ? Math.min(8760, Math.floor(host.offlineCacheTtlHours))
      : DEFAULT_OFFLINE_CACHE_TTL_HOURS;
  return {
    offlinePolicy: policy,
    offlineCacheTtlHours: ttl,
    perScreenOverride: false,
  };
}

export async function resolveOfflinePolicyForScreen(
  screenId: string
): Promise<OfflinePolicyPayload> {
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: {
      host: {
        select: { offlinePolicy: true, offlineCacheTtlHours: true },
      },
    },
  });
  if (!screen?.host) {
    return toOfflinePolicyPayload({});
  }
  return toOfflinePolicyPayload(screen.host);
}

export async function resolveOfflinePolicyForHost(
  hostId: string
): Promise<OfflinePolicyPayload> {
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { offlinePolicy: true, offlineCacheTtlHours: true },
  });
  return toOfflinePolicyPayload(host || {});
}

/**
 * Player-side decision helper (also useful for tests/docs).
 * When offline (API unreachable / no heartbeat within grace):
 * - BLACKOUT or ttlHours === 0 → blackout
 * - PLAY_CACHE and cacheAgeHours <= ttl → play_cache
 * - else → blackout (TTL expired)
 */
export function decideOfflinePlayback(opts: {
  offline: boolean;
  policy: OfflinePolicy;
  ttlHours: number;
  /** Hours since last successful playlist cache write; null = no cache. */
  cacheAgeHours: number | null;
}): "online" | "play_cache" | "blackout" {
  if (!opts.offline) return "online";
  if (opts.policy === "BLACKOUT") return "blackout";
  if (opts.ttlHours <= 0) return "blackout";
  if (opts.cacheAgeHours == null) return "blackout";
  if (opts.cacheAgeHours > opts.ttlHours) return "blackout";
  return "play_cache";
}
