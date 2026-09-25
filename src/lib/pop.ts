/**
 * Ticket F — OptiSigns proof-of-play (PoP) helpers.
 *
 * isHostFiller rule (documented for importers / reports):
 * A row is host filler when Asset Tags OR Asset Name (case-insensitive) contains
 * any of: "filler", "internal", "host-only", "adnabbit filler";
 * OR Asset Name (trimmed, case-insensitive) equals a known placeholder:
 * "placeholder", "n/a", "na", "test", "default", "blank", "none".
 * Default report filters exclude isHostFiller=true.
 */

import { createHash } from "crypto";
import type { Creative, Prisma } from "@prisma/client";

export const OPTISIGNS_REQUIRED_HEADERS = [
  "Report Date UTC",
  "Account ID",
  "Screen UUID",
  "Screen Name",
  "Screen Tags",
  "Asset ID",
  "Asset Name",
  "Asset Tags",
  "Start Time UTC",
  "Device Local Time",
  "Duration (seconds)",
] as const;

export type OptiSignsHeader = (typeof OPTISIGNS_REQUIRED_HEADERS)[number];

const FILLER_SUBSTRINGS = [
  "filler",
  "internal",
  "host-only",
  "adnabbit filler",
] as const;

const PLACEHOLDER_NAMES = new Set([
  "placeholder",
  "n/a",
  "na",
  "test",
  "default",
  "blank",
  "none",
]);

/** Loose IANA-ish check: Area/Location or Area/Location/Sub (letters, digits, _, -, /). */
const IANA_TZ_RE = /^[A-Za-z_]+\/[A-Za-z0-9_\-+]+(?:\/[A-Za-z0-9_\-+]+)?$/;

export function isHostFillerFromCsv(assetName: string, assetTags: string | null | undefined): boolean {
  const name = (assetName || "").trim();
  const tags = (assetTags || "").trim();
  const hay = `${name} ${tags}`.toLowerCase();
  for (const p of FILLER_SUBSTRINGS) {
    if (hay.includes(p)) return true;
  }
  if (PLACEHOLDER_NAMES.has(name.toLowerCase())) return true;
  return false;
}

export function normalizeUtcToIso(raw: string): string {
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid UTC datetime: ${raw}`);
  }
  return d.toISOString();
}

export function computeRawHash(
  screenUuid: string,
  assetId: string,
  startTimeUtcIso: string,
  durationSec: number
): string {
  const payload = `${screenUuid}|${assetId}|${startTimeUtcIso}|${durationSec}`;
  return createHash("sha256").update(payload).digest("hex");
}

export function parseDeviceTimezone(deviceLocalTime: string): string | null {
  const t = (deviceLocalTime || "").trim();
  if (!t) return null;
  if (IANA_TZ_RE.test(t)) return t;
  return null;
}

export function normalizeCreativeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Soft match Asset Name → Creative.
 * Prefer APPROVED among name matches. Never guess across advertisers.
 * Exactly one creative after prefer-APPROVED filter within a single advertiser → match;
 * otherwise null (ambiguous or none).
 */
export function matchCreativeId(
  assetName: string,
  creatives: Pick<Creative, "id" | "name" | "status" | "advertiserId">[]
): string | null {
  const key = normalizeCreativeNameKey(assetName);
  if (!key) return null;

  let matches = creatives.filter((c) => normalizeCreativeNameKey(c.name) === key);
  if (matches.length === 0) return null;

  const approved = matches.filter((c) => c.status === "APPROVED");
  if (approved.length > 0) matches = approved;

  const advertiserIds = new Set(matches.map((c) => c.advertiserId));
  if (advertiserIds.size !== 1) return null;
  if (matches.length !== 1) return null;
  return matches[0].id;
}

/** Minimal RFC4180-ish CSV parse (handles quotes and doubled quotes). */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "") || rows.length === 0) {
        rows.push(row);
      }
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // last field / row
  row.push(field);
  if (row.some((c) => c.trim() !== "") || rows.length === 0) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
  return { headers, rows: data };
}

export function validateOptiSignsHeaders(headers: string[]): string | null {
  const missing = OPTISIGNS_REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return `Missing required OptiSigns header(s): ${missing.join(", ")}. Expected exactly these names: ${OPTISIGNS_REQUIRED_HEADERS.join(", ")}`;
  }
  return null;
}

export type ParsedPlayRow = {
  reportDateUtc: Date;
  accountId: string | null;
  screenUuid: string;
  screenName: string;
  screenTags: string;
  assetId: string;
  assetName: string;
  assetTags: string | null;
  startTimeUtc: Date;
  startTimeUtcIso: string;
  deviceLocalTime: string;
  deviceTimezone: string | null;
  durationSec: number;
  isHostFiller: boolean;
  rawHash: string;
};

export function parseOptiSignsRow(
  headers: string[],
  cells: string[],
  lineNo: number
): ParsedPlayRow {
  const get = (name: OptiSignsHeader) => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? String(cells[idx] ?? "").trim() : "";
  };

  const screenUuid = get("Screen UUID");
  const assetId = get("Asset ID");
  const startRaw = get("Start Time UTC");
  const durationRaw = get("Duration (seconds)");
  const assetName = get("Asset Name");
  const assetTags = get("Asset Tags") || null;
  const deviceLocalTime = get("Device Local Time");

  if (!screenUuid) throw new Error(`Row ${lineNo}: Screen UUID is required`);
  if (!assetId) throw new Error(`Row ${lineNo}: Asset ID is required`);
  if (!startRaw) throw new Error(`Row ${lineNo}: Start Time UTC is required`);

  const durationSec = Number.parseInt(durationRaw, 10);
  if (!Number.isFinite(durationSec) || durationSec < 0) {
    throw new Error(`Row ${lineNo}: Duration (seconds) must be a non-negative integer`);
  }

  let startTimeUtcIso: string;
  try {
    startTimeUtcIso = normalizeUtcToIso(startRaw);
  } catch {
    throw new Error(`Row ${lineNo}: invalid Start Time UTC "${startRaw}"`);
  }
  const startTimeUtc = new Date(startTimeUtcIso);

  const reportRaw = get("Report Date UTC") || startRaw;
  let reportDateUtc: Date;
  try {
    reportDateUtc = new Date(normalizeUtcToIso(reportRaw));
  } catch {
    throw new Error(`Row ${lineNo}: invalid Report Date UTC "${reportRaw}"`);
  }

  const accountId = get("Account ID") || null;
  const screenName = get("Screen Name") || screenUuid;
  const screenTags = get("Screen Tags") || "";

  return {
    reportDateUtc,
    accountId,
    screenUuid,
    screenName,
    screenTags,
    assetId,
    assetName,
    assetTags,
    startTimeUtc,
    startTimeUtcIso,
    deviceLocalTime,
    deviceTimezone: parseDeviceTimezone(deviceLocalTime),
    durationSec,
    isHostFiller: isHostFillerFromCsv(assetName, assetTags),
    rawHash: computeRawHash(screenUuid, assetId, startTimeUtcIso, durationSec),
  };
}

export type PopFilterInput = {
  from?: string | null;
  to?: string | null;
  screen?: string | null;
  asset?: string | null;
  screenTags?: string | null;
  includeFiller?: string | null | boolean;
};

/** Build Prisma where for PlayEvent from report query params. */
export function buildPlayEventWhere(
  filters: PopFilterInput,
  extra?: Prisma.PlayEventWhereInput
): Prisma.PlayEventWhereInput {
  const where: Prisma.PlayEventWhereInput = { ...(extra || {}) };

  const from = filters.from?.trim();
  const to = filters.to?.trim();
  if (from || to) {
    const start: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) start.gte = d;
    }
    if (to) {
      // If date-only (YYYY-MM-DD), treat as end of that UTC day inclusive
      let d: Date;
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        d = new Date(`${to}T23:59:59.999Z`);
      } else {
        d = new Date(to);
      }
      if (!Number.isNaN(d.getTime())) start.lte = d;
    }
    where.startTimeUtc = start;
  }

  const and: Prisma.PlayEventWhereInput[] = [];
  if (Array.isArray(where.AND)) and.push(...where.AND);
  else if (where.AND) and.push(where.AND);

  const screen = filters.screen?.trim();
  if (screen) {
    and.push({
      OR: [
        { screenName: { contains: screen } },
        { screenUuid: { contains: screen } },
      ],
    });
  }

  const asset = filters.asset?.trim();
  if (asset) {
    and.push({
      OR: [{ assetName: { contains: asset } }, { assetId: { contains: asset } }],
    });
  }

  if (and.length) where.AND = and;

  const tags = filters.screenTags?.trim();
  if (tags) {
    where.screenTags = { contains: tags };
  }

  const includeFiller =
    filters.includeFiller === true ||
    filters.includeFiller === "1" ||
    filters.includeFiller === "true" ||
    filters.includeFiller === "on";
  if (!includeFiller) {
    where.isHostFiller = false;
  }

  return where;
}

export function playEventsToCsv(
  events: Array<{
    reportDateUtc: Date;
    accountId: string | null;
    screenUuid: string;
    screenName: string;
    screenTags: string;
    assetId: string;
    assetName: string;
    assetTags: string | null;
    startTimeUtc: Date;
    deviceLocalTime: string;
    deviceTimezone: string | null;
    durationSec: number;
    isHostFiller: boolean;
    creativeId: string | null;
  }>
): string {
  const headers = [
    ...OPTISIGNS_REQUIRED_HEADERS,
    "deviceTimezone",
    "isHostFiller",
    "creativeId",
  ];
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [headers.join(",")];
  for (const e of events) {
    lines.push(
      [
        e.reportDateUtc.toISOString(),
        e.accountId ?? "",
        e.screenUuid,
        e.screenName,
        e.screenTags,
        e.assetId,
        e.assetName,
        e.assetTags ?? "",
        e.startTimeUtc.toISOString(),
        e.deviceLocalTime,
        String(e.durationSec),
        e.deviceTimezone ?? "",
        e.isHostFiller ? "true" : "false",
        e.creativeId ?? "",
      ]
        .map((c) => escape(String(c)))
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
}

export function formatDurationTotal(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s (${seconds}s)`;
  if (m > 0) return `${m}m ${s}s (${seconds}s)`;
  return `${seconds}s`;
}
