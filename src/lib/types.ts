export const ROLES = ["ADVERTISER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const CREATIVE_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"] as const;
export type CreativeStatus = (typeof CREATIVE_STATUSES)[number];

/** Forge schema lock — exact Host.vertical values */
export const HOST_VERTICALS = [
  "RESTAURANT_FB",
  "SPORTS_BAR",
  "GYM",
  "AUTO",
  "MEDICAL_DENTAL",
  "SALON_SPA",
  "RETAIL",
  "GROCERY",
  "WAITING_ROOM",
  "HOTEL",
  "EDUCATION",
  "PROFESSIONAL",
  "GAS_TRAVEL",
  "CHURCH_COMMUNITY",
  "AIRPORT_TRANSIT",
  "OTHER",
] as const;
export type HostVertical = (typeof HOST_VERTICALS)[number];

export const HOST_VERTICAL_LABELS: Record<HostVertical, string> = {
  RESTAURANT_FB: "Restaurant / F&B",
  SPORTS_BAR: "Sports bar",
  GYM: "Gym / Fitness",
  AUTO: "Auto",
  MEDICAL_DENTAL: "Medical / Dental",
  SALON_SPA: "Salon / Spa",
  RETAIL: "Retail",
  GROCERY: "Grocery",
  WAITING_ROOM: "Waiting room",
  HOTEL: "Hotel",
  EDUCATION: "Education",
  PROFESSIONAL: "Professional services",
  GAS_TRAVEL: "Gas / Travel",
  CHURCH_COMMUNITY: "Church / Community",
  AIRPORT_TRANSIT: "Airport / Transit",
  OTHER: "Other",
};

export const INVENTORY_STATUSES = ["OPEN", "LIMITED", "FULL"] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export function isHostVertical(v: string): v is HostVertical {
  return (HOST_VERTICALS as readonly string[]).includes(v);
}

export function isInventoryStatus(v: string): v is InventoryStatus {
  return (INVENTORY_STATUSES as readonly string[]).includes(v);
}

export function formatVertical(vertical: string, otherLabel?: string | null): string {
  if (vertical === "OTHER" && otherLabel) return `Other (${otherLabel})`;
  return HOST_VERTICAL_LABELS[vertical as HostVertical] || vertical;
}


/** Advertiser profile business categories (aligned with host verticals for marketplace fit) */
export const ADVERTISER_CATEGORIES = HOST_VERTICALS;
export type AdvertiserCategory = HostVertical;

export const ADVERTISER_CATEGORY_LABELS = HOST_VERTICAL_LABELS;

export function isAdvertiserCategory(v: string): v is AdvertiserCategory {
  return isHostVertical(v);
}

/** Ticket C — placement request status machine */
export const PLACEMENT_STATUSES = ["REQUESTED", "APPROVED", "REJECTED"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

export function isPlacementStatus(v: string): v is PlacementStatus {
  return (PLACEMENT_STATUSES as readonly string[]).includes(v);
}

/** Ticket D — schedule status machine */
export const SCHEDULE_STATUSES = ["DRAFT", "ACTIVE", "ENDED", "CANCELLED"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export function isScheduleStatus(v: string): v is ScheduleStatus {
  return (SCHEDULE_STATUSES as readonly string[]).includes(v);
}
