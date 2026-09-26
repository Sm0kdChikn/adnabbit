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
