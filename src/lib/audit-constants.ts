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
];

export const AUDIT_TARGET_TYPE_OPTIONS = [
  "creative",
  "advertiser",
  "host",
  "screen",
  "fleet",
  "batch",
] as const;
