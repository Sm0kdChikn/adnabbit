import { createHash, randomBytes, randomInt } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

/** A–Z0–9 excluding ambiguous 0 O 1 I */
export const CLAIM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CLAIM_TTL_MS = 15 * 60 * 1000;
export const CLAIM_CODE_MIN = 6;
export const CLAIM_CODE_MAX = 8;

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateClaimCode(length = 6): string {
  const len = Math.min(CLAIM_CODE_MAX, Math.max(CLAIM_CODE_MIN, length));
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CLAIM_ALPHABET[randomInt(CLAIM_ALPHABET.length)];
  }
  return out;
}

export function normalizeClaimCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidClaimCodeFormat(code: string): boolean {
  if (code.length < CLAIM_CODE_MIN || code.length > CLAIM_CODE_MAX) return false;
  for (const ch of code) {
    if (!CLAIM_ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function extractBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

/** Resolve Device (+ screen/host) from Bearer token, or 401 response. */
export async function requireDeviceAuth(req: Request) {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const tokenHash = hashDeviceToken(token);
  const device = await prisma.device.findUnique({
    where: { tokenHash },
    include: {
      screen: {
        include: {
          host: {
            select: { id: true, name: true, timezone: true },
          },
        },
      },
    },
  });
  if (!device) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { device, token };
}

export async function mintClaimCode(opts: {
  screenId: string;
  createdById?: string | null;
  length?: number;
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CLAIM_TTL_MS);
  // Remint supersedes any still-live unused codes for this screen (TTL edge)
  await prisma.screenClaim.updateMany({
    where: {
      screenId: opts.screenId,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { expiresAt: now },
  });
  // Retry on rare unique collisions
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateClaimCode(opts.length ?? 6);
    try {
      const claim = await prisma.screenClaim.create({
        data: {
          screenId: opts.screenId,
          code,
          expiresAt,
          createdById: opts.createdById ?? null,
        },
      });
      return claim;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("Unique constraint") && !msg.includes("UNIQUE")) {
        throw e;
      }
    }
  }
  throw new Error("Failed to mint unique claim code");
}


/** Ticket O — player considered reachable if lastSeenAt within this window. */
export const PLAYER_ONLINE_GRACE_MS = 5 * 60 * 1000;

export function isDeviceRecentlySeen(
  lastSeenAt: Date | null | undefined,
  now = new Date(),
  graceMs = PLAYER_ONLINE_GRACE_MS
): boolean {
  if (!lastSeenAt) return false;
  return now.getTime() - lastSeenAt.getTime() <= graceMs;
}

/** Ticket P — max screenshot upload size (JPEG). */
export const SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;

/** Ticket P — relative path under uploads/ for the single overwrite preview blob. */
export function remoteViewRelativePath(deviceId: string): string {
  return `device-previews/${deviceId}.jpg`;
}

/** Ticket P — true when admin requested a capture the device has not answered yet. */
export function needsScreenshotCapture(device: {
  screenshotEpoch: number;
  screenshotCapturedEpoch: number;
}): boolean {
  return device.screenshotEpoch > device.screenshotCapturedEpoch;
}

/** Ticket P.1 — max queued remote-control events (oldest dropped when exceeded). */
export const INPUT_QUEUE_MAX = 64;

/** Ticket P.1 — allowed named player commands (optional nice-to-have). */
export const REMOTE_COMMAND_NAMES = ["exitKiosk"] as const;
export type RemoteCommandName = (typeof REMOTE_COMMAND_NAMES)[number];

export type RemoteMouseEvent = {
  type: "mouseDown" | "mouseUp" | "mouseMove" | "mouseClick";
  x: number;
  y: number;
  button?: "left" | "right" | "middle";
  clickCount?: number;
  /** Capture / natural image width when the click was mapped (for player scale). */
  captureWidth?: number;
  captureHeight?: number;
};

export type RemoteKeyEvent = {
  type: "keyDown" | "keyUp" | "char";
  /** Electron-style keyCode e.g. Return, Escape, Left, a */
  keyCode: string;
  modifiers?: Array<"shift" | "control" | "alt" | "meta">;
};

export type RemoteCommandEvent = {
  type: "command";
  name: RemoteCommandName;
};

export type RemoteInputEvent =
  | RemoteMouseEvent
  | RemoteKeyEvent
  | RemoteCommandEvent;

function isFiniteCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isValidModifiers(m: unknown): m is RemoteKeyEvent["modifiers"] {
  if (m === undefined) return true;
  if (!Array.isArray(m)) return false;
  const ok = new Set(["shift", "control", "alt", "meta"]);
  return m.every((x) => typeof x === "string" && ok.has(x));
}

/** Validate and normalize a single remote input event; returns null if invalid. */
export function normalizeRemoteInputEvent(raw: unknown): RemoteInputEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const type = e.type;

  if (
    type === "mouseDown" ||
    type === "mouseUp" ||
    type === "mouseMove" ||
    type === "mouseClick"
  ) {
    if (!isFiniteCoord(e.x) || !isFiniteCoord(e.y)) return null;
    const button =
      e.button === "right" || e.button === "middle" || e.button === "left"
        ? e.button
        : "left";
    const clickCount =
      typeof e.clickCount === "number" &&
      Number.isFinite(e.clickCount) &&
      e.clickCount >= 1
        ? Math.min(3, Math.floor(e.clickCount))
        : 1;
    const out: RemoteMouseEvent = {
      type,
      x: Math.round(e.x),
      y: Math.round(e.y),
      button,
      clickCount,
    };
    if (isFiniteCoord(e.captureWidth) && e.captureWidth > 0) {
      out.captureWidth = Math.round(e.captureWidth);
    }
    if (isFiniteCoord(e.captureHeight) && e.captureHeight > 0) {
      out.captureHeight = Math.round(e.captureHeight);
    }
    return out;
  }

  if (type === "keyDown" || type === "keyUp" || type === "char") {
    if (typeof e.keyCode !== "string" || !e.keyCode.trim()) return null;
    if (!isValidModifiers(e.modifiers)) return null;
    const keyCode = e.keyCode.trim().slice(0, 32);
    const out: RemoteKeyEvent = { type, keyCode };
    if (e.modifiers && e.modifiers.length) {
      out.modifiers = e.modifiers as RemoteKeyEvent["modifiers"];
    }
    return out;
  }

  if (type === "command") {
    if (typeof e.name !== "string") return null;
    if (!(REMOTE_COMMAND_NAMES as readonly string[]).includes(e.name)) {
      return null;
    }
    return { type: "command", name: e.name as RemoteCommandName };
  }

  return null;
}

export function parsePendingInputJson(
  raw: string | null | undefined
): RemoteInputEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RemoteInputEvent[] = [];
    for (const item of parsed) {
      const n = normalizeRemoteInputEvent(item);
      if (n) out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}

/** Append events; drop oldest if over INPUT_QUEUE_MAX. */
export function appendPendingInput(
  existingJson: string | null | undefined,
  incoming: RemoteInputEvent[]
): { json: string; queueLength: number; dropped: number } {
  const queue = parsePendingInputJson(existingJson);
  const before = queue.length;
  queue.push(...incoming);
  let dropped = 0;
  if (queue.length > INPUT_QUEUE_MAX) {
    dropped = queue.length - INPUT_QUEUE_MAX;
    queue.splice(0, dropped);
  }
  void before;
  return {
    json: JSON.stringify(queue),
    queueLength: queue.length,
    dropped,
  };
}

export function hasPendingInput(
  pendingInputJson: string | null | undefined
): boolean {
  if (!pendingInputJson) return false;
  try {
    const parsed = JSON.parse(pendingInputJson);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}
