import type { DeviceDisplayStatus } from "@/lib/open-hours";

const LABELS: Record<DeviceDisplayStatus, string> = {
  UNPAIRED: "Unpaired",
  OFFLINE: "Offline",
  LIVE: "Live",
  BLACKOUT: "Closed hours",
  IDLE: "Idle",
  EMPTY: "Empty playlist",
};

const STYLES: Record<DeviceDisplayStatus, string> = {
  UNPAIRED: "bg-slate-500/20 text-slate-300",
  OFFLINE: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
  LIVE: "bg-emerald-500/15 text-emerald-400",
  BLACKOUT: "bg-slate-700/60 text-slate-200 ring-1 ring-slate-500/40",
  IDLE: "bg-amber-500/15 text-amber-300",
  EMPTY: "bg-amber-500/15 text-amber-300",
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]} ${className}`}
      title={
        status === "BLACKOUT"
          ? "Device online but dark — outside venue open hours (soft blackout)"
          : status === "EMPTY"
            ? "Online and open, but no creatives in the current window"
            : status === "IDLE"
              ? "Online — waiting / idle"
              : undefined
      }
    >
      {LABELS[status]}
    </span>
  );
}
