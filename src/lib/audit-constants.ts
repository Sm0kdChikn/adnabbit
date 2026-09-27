/** Ticket W — client-safe audit filter option lists (no prisma). */

export const AUDIT_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "take_down", label: "Take-down" },
  { value: "undo_take_down", label: "Undo take-down" },
  { value: "fleet.bulk", label: "Fleet bulk" },
  { value: "force_live.set", label: "Force-live set" },
  { value: "force_live.clear", label: "Force-live clear" },
  { value: "open_hours.save", label: "Open hours save" },
  { value: "download_hours.save", label: "Download hours save" },
  { value: "offline_policy.save", label: "Offline policy save" },
  { value: "maintenance.create", label: "Maintenance create" },
  { value: "maintenance.clear", label: "Maintenance clear" },
  { value: "output.save", label: "Output save" },
  { value: "output.apply", label: "Output apply" },
  { value: "device_group.create", label: "Device group create" },
  { value: "device_group.update", label: "Device group update" },
  { value: "device_group.delete", label: "Device group delete" },
  { value: "device_group.member_add", label: "Device group member add" },
  { value: "device_group.member_remove", label: "Device group member remove" },
];

export const AUDIT_TARGET_TYPE_OPTIONS = [
  "creative",
  "advertiser",
  "host",
  "screen",
  "fleet",
  "batch",
  "device_group",
] as const;
