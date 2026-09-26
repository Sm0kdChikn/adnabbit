import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { listFleetHealth, scanFleetAlerts } from "@/lib/fleet";
import { PLAYER_ONLINE_GRACE_MS } from "@/lib/device";

export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const scan =
    searchParams.get("scan") === "1" || searchParams.get("scan") === "true";
  const filter = (searchParams.get("filter") || "all").toLowerCase();
  const apiBase = process.env.NEXTAUTH_URL || new URL(req.url).origin;

  let scanResult = null;
  if (scan) {
    scanResult = await scanFleetAlerts({ apiBase });
  }

  const all = await listFleetHealth({ apiBase });
  const counts = {
    all: all.length,
    offline: all.filter((s) => !s.online).length,
    empty: all.filter((s) => s.emptyPlaylist).length,
    version: all.filter(
      (s) => s.versionStatus === "missing" || s.versionStatus === "lag"
    ).length,
    attention: all.filter((s) => s.attention).length,
  };

  let screens = all;
  if (filter === "offline") screens = all.filter((s) => !s.online);
  else if (filter === "empty") screens = all.filter((s) => s.emptyPlaylist);
  else if (filter === "version")
    screens = all.filter(
      (s) => s.versionStatus === "missing" || s.versionStatus === "lag"
    );
  else if (filter === "attention") screens = all.filter((s) => s.attention);

  return NextResponse.json({
    graceMs: PLAYER_ONLINE_GRACE_MS,
    filter,
    counts,
    screens,
    scan: scanResult,
  });
}

/** POST — run alert scan (lightweight poll / cron hook). */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const result = await scanFleetAlerts({
    apiBase: process.env.NEXTAUTH_URL || new URL(req.url).origin,
  });
  return NextResponse.json({ ok: true, ...result });
}
