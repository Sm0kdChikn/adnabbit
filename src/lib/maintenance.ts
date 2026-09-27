/**
 * Ticket X — one-off maintenance windows (HOST | SCREEN).
 * Active = now ∈ [startsAt, endsAt). Screen overlapping window wins; else inherit host.
 * Soft blackout + PoP mute like CLOSED_HOURS; beats force-live.
 * Soft miss: recurring / bulk. Out: auto-reboot-into-window, OptiSigns, email; Y/Z.
 */
import { prisma } from "./prisma";
import { writeAuditEvent } from "./audit";
import { bumpPlaylistEpochForScreens } from "./take-down";

export const MAINTENANCE_SCOPES = ["HOST", "SCREEN"] as const;
export type MaintenanceScope = (typeof MAINTENANCE_SCOPES)[number];

export type MaintenancePayload = {
  active: boolean;
  endsAt: string | null;
  startsAt: string | null;
  scope: MaintenanceScope | null;
  windowId: string | null;
  note: string | null;
};

export type MaintenanceWindowRow = {
  id: string;
  scope: MaintenanceScope;
  targetId: string;
  startsAt: string;
  endsAt: string;
  createdById: string;
  note: string | null;
  createdAt: string;
  /** Active right now */
  active: boolean;
};

export function emptyMaintenance(): MaintenancePayload {
  return {
    active: false,
    endsAt: null,
    startsAt: null,
    scope: null,
    windowId: null,
    note: null,
  };
}

function isActiveWindow(
  startsAt: Date,
  endsAt: Date,
  now: Date
): boolean {
  const t = now.getTime();
  return startsAt.getTime() <= t && t < endsAt.getTime();
}

function toRow(w: {
  id: string;
  scope: string;
  targetId: string;
  startsAt: Date;
  endsAt: Date;
  createdById: string;
  note: string | null;
  createdAt: Date;
}, now: Date): MaintenanceWindowRow {
  return {
    id: w.id,
    scope: w.scope === "SCREEN" ? "SCREEN" : "HOST",
    targetId: w.targetId,
    startsAt: w.startsAt.toISOString(),
    endsAt: w.endsAt.toISOString(),
    createdById: w.createdById,
    note: w.note,
    createdAt: w.createdAt.toISOString(),
    active: isActiveWindow(w.startsAt, w.endsAt, now),
  };
}

/** Pick the overlapping window that ends latest (longest remaining). */
function pickActive(
  windows: {
    id: string;
    scope: string;
    targetId: string;
    startsAt: Date;
    endsAt: Date;
    note: string | null;
  }[],
  now: Date,
  scope: MaintenanceScope
): MaintenancePayload {
  const active = windows
    .filter((w) => isActiveWindow(w.startsAt, w.endsAt, now))
    .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
  const w = active[0];
  if (!w) return emptyMaintenance();
  return {
    active: true,
    endsAt: w.endsAt.toISOString(),
    startsAt: w.startsAt.toISOString(),
    scope,
    windowId: w.id,
    note: w.note,
  };
}

/**
 * Resolve effective maintenance for a screen.
 * Any overlapping SCREEN window wins; else inherit HOST windows for the venue.
 */
export async function resolveMaintenanceForScreen(
  screenId: string,
  now = new Date()
): Promise<MaintenancePayload> {
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: { id: true, hostId: true },
  });
  if (!screen) return emptyMaintenance();

  const screenWindows = await prisma.maintenanceWindow.findMany({
    where: {
      scope: "SCREEN",
      targetId: screen.id,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: { endsAt: "desc" },
  });
  if (screenWindows.length > 0) {
    return pickActive(screenWindows, now, "SCREEN");
  }

  const hostWindows = await prisma.maintenanceWindow.findMany({
    where: {
      scope: "HOST",
      targetId: screen.hostId,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: { endsAt: "desc" },
  });
  return pickActive(hostWindows, now, "HOST");
}

/** List windows for a target (active + future by default). */
export async function listMaintenanceWindows(opts: {
  scope: MaintenanceScope;
  targetId: string;
  /** Include ended windows (default false) */
  includePast?: boolean;
  now?: Date;
  limit?: number;
}): Promise<MaintenanceWindowRow[]> {
  const now = opts.now ?? new Date();
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const rows = await prisma.maintenanceWindow.findMany({
    where: {
      scope: opts.scope,
      targetId: opts.targetId,
      ...(opts.includePast ? {} : { endsAt: { gt: now } }),
    },
    orderBy: [{ startsAt: "asc" }],
    take: limit,
  });
  return rows.map((r) => toRow(r, now));
}

export type CreateMaintenanceResult =
  | {
      ok: true;
      window: MaintenanceWindowRow;
      affectedDevices: number;
    }
  | { error: string; status: number };

export async function createMaintenanceWindow(opts: {
  scope: MaintenanceScope;
  targetId: string;
  startsAt: Date;
  endsAt: Date;
  createdById: string;
  note?: string | null;
  now?: Date;
}): Promise<CreateMaintenanceResult> {
  const now = opts.now ?? new Date();
  if (!(opts.startsAt instanceof Date) || Number.isNaN(opts.startsAt.getTime())) {
    return { error: "startsAt must be a valid ISO timestamp", status: 400 };
  }
  if (!(opts.endsAt instanceof Date) || Number.isNaN(opts.endsAt.getTime())) {
    return { error: "endsAt must be a valid ISO timestamp", status: 400 };
  }
  if (opts.endsAt.getTime() <= opts.startsAt.getTime()) {
    return { error: "endsAt must be after startsAt", status: 400 };
  }

  if (opts.scope === "HOST") {
    const host = await prisma.host.findUnique({
      where: { id: opts.targetId },
      select: { id: true },
    });
    if (!host) return { error: "Host not found", status: 404 };
  } else {
    const screen = await prisma.screen.findUnique({
      where: { id: opts.targetId },
      select: { id: true },
    });
    if (!screen) return { error: "Screen not found", status: 404 };
  }

  const row = await prisma.maintenanceWindow.create({
    data: {
      scope: opts.scope,
      targetId: opts.targetId,
      startsAt: opts.startsAt,
      endsAt: opts.endsAt,
      createdById: opts.createdById,
      note: opts.note?.trim() || null,
    },
  });

  const screenIds =
    opts.scope === "HOST"
      ? (
          await prisma.screen.findMany({
            where: { hostId: opts.targetId },
            select: { id: true },
          })
        ).map((s) => s.id)
      : [opts.targetId];
  const affectedDevices = await bumpPlaylistEpochForScreens(screenIds);

  await writeAuditEvent({
    actorUserId: opts.createdById,
    action: "maintenance.create",
    targetType: opts.scope === "HOST" ? "host" : "screen",
    targetId: opts.targetId,
    reason: opts.note?.trim() || null,
    meta: {
      windowId: row.id,
      scope: opts.scope,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      affectedDevices,
    },
  });

  return {
    ok: true,
    window: toRow(row, now),
    affectedDevices,
  };
}

export type ClearMaintenanceResult =
  | {
      ok: true;
      cleared: number;
      clearedIds: string[];
      affectedDevices: number;
    }
  | { error: string; status: number };

/**
 * Clear one window by id, or all non-ended windows for the target.
 * Ending early = delete (one-off model; soft miss: truncate endsAt).
 */
export async function clearMaintenanceWindows(opts: {
  scope: MaintenanceScope;
  targetId: string;
  actorUserId: string;
  /** If set, clear only this window (must match scope/target) */
  windowId?: string | null;
  now?: Date;
}): Promise<ClearMaintenanceResult> {
  const now = opts.now ?? new Date();

  if (opts.windowId) {
    const existing = await prisma.maintenanceWindow.findUnique({
      where: { id: opts.windowId },
    });
    if (
      !existing ||
      existing.scope !== opts.scope ||
      existing.targetId !== opts.targetId
    ) {
      return { error: "Maintenance window not found", status: 404 };
    }
    await prisma.maintenanceWindow.delete({ where: { id: existing.id } });
    const screenIds =
      opts.scope === "HOST"
        ? (
            await prisma.screen.findMany({
              where: { hostId: opts.targetId },
              select: { id: true },
            })
          ).map((s) => s.id)
        : [opts.targetId];
    const affectedDevices = await bumpPlaylistEpochForScreens(screenIds);
    await writeAuditEvent({
      actorUserId: opts.actorUserId,
      action: "maintenance.clear",
      targetType: opts.scope === "HOST" ? "host" : "screen",
      targetId: opts.targetId,
      meta: {
        windowId: existing.id,
        scope: opts.scope,
        cleared: 1,
        affectedDevices,
        wasActive: isActiveWindow(existing.startsAt, existing.endsAt, now),
      },
    });
    return {
      ok: true,
      cleared: 1,
      clearedIds: [existing.id],
      affectedDevices,
    };
  }

  const toClear = await prisma.maintenanceWindow.findMany({
    where: {
      scope: opts.scope,
      targetId: opts.targetId,
      endsAt: { gt: now },
    },
    select: { id: true },
  });
  if (toClear.length === 0) {
    return { ok: true, cleared: 0, clearedIds: [], affectedDevices: 0 };
  }
  const ids = toClear.map((r) => r.id);
  await prisma.maintenanceWindow.deleteMany({
    where: { id: { in: ids } },
  });

  const screenIds =
    opts.scope === "HOST"
      ? (
          await prisma.screen.findMany({
            where: { hostId: opts.targetId },
            select: { id: true },
          })
        ).map((s) => s.id)
      : [opts.targetId];
  const affectedDevices = await bumpPlaylistEpochForScreens(screenIds);

  await writeAuditEvent({
    actorUserId: opts.actorUserId,
    action: "maintenance.clear",
    targetType: opts.scope === "HOST" ? "host" : "screen",
    targetId: opts.targetId,
    meta: {
      scope: opts.scope,
      cleared: ids.length,
      clearedIds: ids,
      affectedDevices,
    },
  });

  return {
    ok: true,
    cleared: ids.length,
    clearedIds: ids,
    affectedDevices,
  };
}

/** Parse body timestamps for create. */
export function parseMaintenanceBody(body: {
  startsAt?: unknown;
  endsAt?: unknown;
  note?: unknown;
}):
  | { ok: true; startsAt: Date; endsAt: Date; note: string | null }
  | { ok: false; error: string } {
  if (typeof body.startsAt !== "string" || !body.startsAt.trim()) {
    return { ok: false, error: "startsAt is required (ISO timestamp)" };
  }
  if (typeof body.endsAt !== "string" || !body.endsAt.trim()) {
    return { ok: false, error: "endsAt is required (ISO timestamp)" };
  }
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "startsAt must be a valid ISO timestamp" };
  }
  if (Number.isNaN(endsAt.getTime())) {
    return { ok: false, error: "endsAt must be a valid ISO timestamp" };
  }
  const note =
    typeof body.note === "string" ? body.note.trim() || null : null;
  return { ok: true, startsAt, endsAt, note };
}
