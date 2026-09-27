import type { DeviceDisplayStatus } from "@/lib/open-hours";
import { badgeBase, statusTone } from "@/components/StatusBadge";

const LABELS: Record<DeviceDisplayStatus, string> = {
  UNPAIRED: "Unpaired",
  OFFLINE: "OFFLINE",
  LIVE: "Live",
  BLACKOUT: "CLOSED",
  MAINTENANCE: "MAINTENANCE",
  IDLE: "Idle",
  EMPTY: "Empty playlist",
};

const STYLES: Record<DeviceDisplayStatus, string> = {
  UNPAIRED: statusTone.neutral,
  OFFLINE: statusTone.danger,
  LIVE: statusTone.success,
  BLACKOUT: statusTone.neutral,
  MAINTENANCE: statusTone.info,
  IDLE: statusTone.warning,
  EMPTY: statusTone.warning,
};

const TITLES: Partial<Record<DeviceDisplayStatus, string>> = {
  MAINTENANCE:
    "Device online but dark — maintenance window (soft blackout; beats force-live)",
  BLACKOUT:
    "Device online but dark — outside venue open hours (soft blackout)",
  EMPTY: "Online and open, but no creatives in the current window",
  IDLE: "Online — waiting / idle",
};

export function DeviceStatusBadge({
  status,
  className = "",
}: {
  status: DeviceDisplayStatus;
  className?: string;
}) {
  return (
    <span
      className={`${badgeBase} ${STYLES[status]} ${className}`}
      title={TITLES[status]}
    >
      {LABELS[status]}
    </span>
  );
}
