import type {
  CreativeStatus,
  InventoryStatus,
  PlacementStatus,
  ScheduleStatus,
} from "@/lib/types";

/** Shared charcoal/cyan portal badge chrome (Ticket UP). */
export const badgeBase =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-border";

export const statusTone = {
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-fg)]",
} as const;

export type StatusTone = keyof typeof statusTone;

const creativeStyles: Record<CreativeStatus, string> = {
  DRAFT: statusTone.neutral,
  PENDING: statusTone.warning,
  APPROVED: statusTone.success,
  REJECTED: statusTone.danger,
};

const inventoryStyles: Record<InventoryStatus, string> = {
  OPEN: statusTone.success,
  LIMITED: statusTone.warning,
  FULL: statusTone.danger,
};

const placementStyles: Record<PlacementStatus, string> = {
  REQUESTED: statusTone.warning,
  APPROVED: statusTone.success,
  REJECTED: statusTone.danger,
};

const scheduleStyles: Record<ScheduleStatus, string> = {
  DRAFT: statusTone.neutral,
  ACTIVE: statusTone.success,
  ENDED: statusTone.neutral,
  CANCELLED: statusTone.danger,
};

export function StatusBadge({ status }: { status: string }) {
  const s =
    creativeStyles[status as CreativeStatus] ||
    placementStyles[status as PlacementStatus] ||
    scheduleStyles[status as ScheduleStatus] ||
    statusTone.neutral;
  return <span className={`${badgeBase} ${s}`}>{status}</span>;
}

export function InventoryBadge({ status }: { status: string }) {
  const s =
    inventoryStyles[status as InventoryStatus] || statusTone.neutral;
  return <span className={`${badgeBase} ${s}`}>{status}</span>;
}

export function PlacementBadge({ status }: { status: string }) {
  const s =
    placementStyles[status as PlacementStatus] || statusTone.neutral;
  return <span className={`${badgeBase} ${s}`}>{status}</span>;
}

export function ScheduleBadge({ status }: { status: string }) {
  const s =
    scheduleStyles[status as ScheduleStatus] || statusTone.neutral;
  return <span className={`${badgeBase} ${s}`}>{status}</span>;
}

const windowPhaseStyles: Record<string, string> = {
  ACTIVE: statusTone.success,
  SCHEDULED: statusTone.warning,
  EXPIRED: statusTone.neutral,
  DRAFT: statusTone.neutral,
  CANCELLED: statusTone.danger,
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
  const s = windowPhaseStyles[phase] || statusTone.neutral;
  const label = windowPhaseLabel[phase] || phase;
  return <span className={`${badgeBase} ${s}`}>{label}</span>;
}

/** Generic portal status chip — prefer over one-off badge markup (Ticket UP). */
export function StatusChip({
  tone = "neutral",
  children,
  className = "",
  title,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={`${badgeBase} ${statusTone[tone]} ${className}`} title={title}>
      {children}
    </span>
  );
}

/**
 * Hours open/closed chip — maps to open-hours wire (isOpenNow / hoursStatus),
 * not a parallel enum.
 */
export function HoursStatusChip({
  open,
  openLabel = "OPEN",
  closedLabel = "CLOSED",
  forceLive = false,
}: {
  open: boolean;
  openLabel?: string;
  closedLabel?: string;
  forceLive?: boolean;
}) {
  if (forceLive && open) {
    return (
      <StatusChip tone="success" title="Force-live bypass active">
        OPEN · force live
      </StatusChip>
    );
  }
  return (
    <StatusChip tone={open ? "success" : "neutral"}>
      {open ? openLabel : closedLabel}
    </StatusChip>
  );
}

/** Maintenance active chip — maps to MaintenanceWindow effective state. */
export function MaintenanceStatusChip({
  active,
  endsAt,
  scope,
}: {
  active: boolean;
  endsAt?: string | null;
  scope?: string | null;
}) {
  if (!active) {
    return <StatusChip tone="neutral">Not in maintenance</StatusChip>;
  }
  const ends =
    endsAt && !Number.isNaN(Date.parse(endsAt))
      ? ` · ends ${new Date(endsAt).toLocaleString()}`
      : "";
  const scopeBit = scope ? ` · ${scope}` : "";
  return (
    <StatusChip
      tone="info"
      title="Maintenance soft blackout — beats force-live; PoP muted"
    >
      MAINTENANCE{scopeBit}
      {ends}
    </StatusChip>
  );
}

/** Fleet / host online affinity — maps to heartbeat freshness, not a new enum. */
export function OnlineStatusChip({
  state,
}: {
  state: "online" | "offline" | "unpaired";
}) {
  if (state === "online") {
    return <StatusChip tone="success">Online</StatusChip>;
  }
  if (state === "offline") {
    return <StatusChip tone="danger">OFFLINE</StatusChip>;
  }
  return <StatusChip tone="neutral">Unpaired</StatusChip>;
}

/** Offline play policy chip — maps to Host.offlinePolicy / TTL already on the wire. */
export function OfflinePolicyChip({
  online,
  policy,
  ttlHours,
  mayPlayCache,
}: {
  online: boolean;
  policy: "PLAY_CACHE" | "BLACKOUT" | string;
  ttlHours: number;
  mayPlayCache?: boolean;
}) {
  if (!online) {
    if (mayPlayCache) {
      return (
        <StatusChip
          tone="warning"
          title="Best-effort: host PLAY_CACHE + TTL > 0"
        >
          Offline · cache {ttlHours}h
        </StatusChip>
      );
    }
    const blackout =
      policy === "BLACKOUT" || ttlHours === 0 ? "blackout" : policy;
    return (
      <StatusChip tone="danger">
        Offline · {blackout}
      </StatusChip>
    );
  }
  if (policy === "BLACKOUT") {
    return <StatusChip tone="neutral">BLACKOUT</StatusChip>;
  }
  return (
    <StatusChip tone="neutral">
      Play cache {ttlHours}h
    </StatusChip>
  );
}
