import { prisma } from "./prisma";

/** Overlap: [startA, endA) intersects [startB, endB) */
export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA < endB && startB < endA;
}

/**
 * Mark ACTIVE schedules whose endAt is in the past as ENDED.
 * Call on list/read paths so UI stays current without a cron.
 */
export async function materializeEndedSchedules(ids?: string[]) {
  const now = new Date();
  const where = {
    status: "ACTIVE" as const,
    endAt: { lt: now },
    ...(ids && ids.length ? { id: { in: ids } } : {}),
  };
  const result = await prisma.schedule.updateMany({ where, data: { status: "ENDED" } });
  return result.count;
}

/**
 * Find ACTIVE schedules on the same screen that overlap [startAt, endAt).
 * Excludes excludeId (for edits). Warn-first — caller decides whether to block.
 */
export async function findOverlappingActiveSchedules(opts: {
  screenId: string;
  startAt: Date;
  endAt: Date;
  excludeId?: string;
}) {
  const candidates = await prisma.schedule.findMany({
    where: {
      screenId: opts.screenId,
      status: "ACTIVE",
      ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
      // coarse filter: not completely before or after
      startAt: { lt: opts.endAt },
      endAt: { gt: opts.startAt },
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      placementId: true,
      note: true,
    },
  });
  return candidates.filter((c) =>
    rangesOverlap(opts.startAt, opts.endAt, c.startAt, c.endAt)
  );
}

export const scheduleInclude = {
  placement: {
    include: {
      advertiser: { select: { id: true, email: true, name: true } },
      creative: {
        select: {
          id: true,
          name: true,
          status: true,
          fileName: true,
          storedName: true,
          mimeType: true,
        },
      },
      screen: {
        include: {
          host: { select: { id: true, name: true, vertical: true, otherLabel: true } },
        },
      },
    },
  },
  screen: {
    include: {
      host: { select: { id: true, name: true, vertical: true, otherLabel: true } },
    },
  },
  createdBy: { select: { id: true, email: true, name: true } },
} as const;
