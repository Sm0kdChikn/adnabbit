/**
 * Ticket W — append-only AuditEvent helper.
 * No update/delete APIs. Soft miss: CSV export, host/advertiser self-view, WORM/SIEM/email.
 */
import { prisma } from "./prisma";

export type AuditTargetType =
  | "creative"
  | "advertiser"
  | "host"
  | "screen"
  | "fleet"
  | "batch";

export type AuditAction =
  | "take_down"
  | "undo_take_down"
  | "fleet.bulk"
  | "force_live.set"
  | "force_live.clear"
  | "open_hours.save"
  | "download_hours.save"
  | "offline_policy.save";

export type WriteAuditInput = {
  actorUserId: string;
  action: AuditAction | string;
  targetType: AuditTargetType | string;
  targetId: string;
  reason?: string | null;
  meta?: Record<string, unknown> | null;
};

/** Persist one append-only audit row. Never throws to callers — logs and returns null on failure. */
export async function writeAuditEvent(
  input: WriteAuditInput
): Promise<{ id: string } | null> {
  try {
    const meta =
      input.meta === undefined || input.meta === null
        ? null
        : JSON.stringify(input.meta);
    const row = await prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason?.trim() || null,
        meta,
      },
      select: { id: true },
    });
    return row;
  } catch (e) {
    console.error("[audit] writeAuditEvent failed", e);
    return null;
  }
}

export type AuditListFilters = {
  action?: string;
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  /** Inclusive start (ISO or date) */
  from?: string;
  /** Inclusive end (ISO or date) — end-of-day if date-only */
  to?: string;
  limit?: number;
  offset?: number;
};

function parseFrom(raw?: string): Date | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  const d = new Date(s.length <= 10 ? `${s}T00:00:00.000Z` : s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseTo(raw?: string): Date | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  // Date-only → end of that UTC day inclusive
  const d = new Date(s.length <= 10 ? `${s}T23:59:59.999Z` : s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function buildAuditWhere(filters: AuditListFilters) {
  const where: {
    action?: string;
    actorUserId?: string;
    targetType?: string;
    targetId?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};
  if (filters.action?.trim()) where.action = filters.action.trim();
  if (filters.actorUserId?.trim()) where.actorUserId = filters.actorUserId.trim();
  if (filters.targetType?.trim()) where.targetType = filters.targetType.trim();
  if (filters.targetId?.trim()) where.targetId = filters.targetId.trim();
  const gte = parseFrom(filters.from);
  const lte = parseTo(filters.to);
  if (gte || lte) {
    where.createdAt = {};
    if (gte) where.createdAt.gte = gte;
    if (lte) where.createdAt.lte = lte;
  }
  return where;
}

export async function listAuditEvents(filters: AuditListFilters = {}) {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);
  const where = buildAuditWhere(filters);

  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  const actorIds = Array.from(new Set(rows.map((r) => r.actorUserId)));
  const actors =
    actorIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true, name: true, role: true },
        });
  const actorById = new Map(actors.map((a) => [a.id, a]));

  const events = rows.map((r) => {
    let meta: unknown = null;
    if (r.meta) {
      try {
        meta = JSON.parse(r.meta);
      } catch {
        meta = r.meta;
      }
    }
    const actor = actorById.get(r.actorUserId) ?? null;
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      actorUserId: r.actorUserId,
      actorEmail: actor?.email ?? null,
      actorName: actor?.name ?? null,
      actorRole: actor?.role ?? null,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      meta,
    };
  });

  return { events, total, limit, offset };
}

export {
  AUDIT_ACTION_OPTIONS,
  AUDIT_TARGET_TYPE_OPTIONS,
} from "./audit-constants";
