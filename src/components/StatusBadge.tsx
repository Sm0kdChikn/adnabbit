import type {
  CreativeStatus,
  InventoryStatus,
  PlacementStatus,
  ScheduleStatus,
} from "@/lib/types";

const creativeStyles: Record<CreativeStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

const inventoryStyles: Record<InventoryStatus, string> = {
  OPEN: "bg-emerald-100 text-emerald-800",
  LIMITED: "bg-amber-100 text-amber-800",
  FULL: "bg-rose-100 text-rose-800",
};

const placementStyles: Record<PlacementStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

const scheduleStyles: Record<ScheduleStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  ENDED: "bg-slate-200 text-slate-600",
  CANCELLED: "bg-rose-100 text-rose-800",
};

export function StatusBadge({ status }: { status: string }) {
  const s =
    creativeStyles[status as CreativeStatus] ||
    placementStyles[status as PlacementStatus] ||
    scheduleStyles[status as ScheduleStatus] ||
    "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s}`}>
      {status}
    </span>
  );
}

export function InventoryBadge({ status }: { status: string }) {
  const s = inventoryStyles[status as InventoryStatus] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s}`}>
      {status}
    </span>
  );
}

export function PlacementBadge({ status }: { status: string }) {
  const s = placementStyles[status as PlacementStatus] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s}`}>
      {status}
    </span>
  );
}

export function ScheduleBadge({ status }: { status: string }) {
  const s = scheduleStyles[status as ScheduleStatus] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s}`}>
      {status}
    </span>
  );
}
