import type {
  CreativeStatus,
  InventoryStatus,
  PlacementStatus,
  ScheduleStatus,
} from "@/lib/types";

const creativeStyles: Record<CreativeStatus, string> = {
  DRAFT: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  PENDING: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]",
  APPROVED: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]",
  REJECTED: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
};

const inventoryStyles: Record<InventoryStatus, string> = {
  OPEN: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]",
  LIMITED: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]",
  FULL: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
};

const placementStyles: Record<PlacementStatus, string> = {
  REQUESTED: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]",
  APPROVED: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]",
  REJECTED: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
};

const scheduleStyles: Record<ScheduleStatus, string> = {
  DRAFT: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  ACTIVE: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]",
  ENDED: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  CANCELLED: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
};

const badgeBase =
  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-border";

export function StatusBadge({ status }: { status: string }) {
  const s =
    creativeStyles[status as CreativeStatus] ||
    placementStyles[status as PlacementStatus] ||
    scheduleStyles[status as ScheduleStatus] ||
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]";
  return <span className={`${badgeBase} ${s}`}>{status}</span>;
}

export function InventoryBadge({ status }: { status: string }) {
  const s =
    inventoryStyles[status as InventoryStatus] ||
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]";
  return <span className={`${badgeBase} ${s}`}>{status}</span>;
}

export function PlacementBadge({ status }: { status: string }) {
  const s =
    placementStyles[status as PlacementStatus] ||
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]";
  return <span className={`${badgeBase} ${s}`}>{status}</span>;
}

export function ScheduleBadge({ status }: { status: string }) {
  const s =
    scheduleStyles[status as ScheduleStatus] ||
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]";
  return <span className={`${badgeBase} ${s}`}>{status}</span>;
}

const windowPhaseStyles: Record<string, string> = {
  ACTIVE: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]",
  SCHEDULED: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]",
  EXPIRED: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  DRAFT: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  CANCELLED: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
};

const windowPhaseLabel: Record<string, string> = {
  ACTIVE: "Active",
  SCHEDULED: "Scheduled",
  EXPIRED: "Expired",
  DRAFT: "Draft",
  CANCELLED: "Cancelled",
};

/** Ticket S — campaign window phase (Schedule start/end). */
export function WindowPhaseBadge({ phase }: { phase: string }) {
  const s =
    windowPhaseStyles[phase] ||
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]";
  const label = windowPhaseLabel[phase] || phase;
  return <span className={`${badgeBase} ${s}`}>{label}</span>;
}
