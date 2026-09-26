import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import {
  countOpenFleetAlerts,
  listFleetAlerts,
  scanFleetAlerts,
  FLEET_ALERT_KINDS,
  type FleetAlertKind,
  type FleetAlertStatus,
} from "@/lib/fleet";

export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  if (searchParams.get("count") === "1") {
    const openCount = await countOpenFleetAlerts();
    return NextResponse.json({ openCount });
  }

  const statusRaw = (searchParams.get("status") || "OPEN").toUpperCase();
  const status =
    statusRaw === "ALL" || statusRaw === "OPEN" || statusRaw === "RESOLVED"
      ? (statusRaw as FleetAlertStatus | "ALL")
      : "OPEN";
  const kindRaw = searchParams.get("kind")?.toUpperCase();
  const kind =
    kindRaw && (FLEET_ALERT_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as FleetAlertKind)
      : undefined;

  if (searchParams.get("scan") === "1") {
    await scanFleetAlerts({
      apiBase: process.env.NEXTAUTH_URL || new URL(req.url).origin,
    });
  }

  const alerts = await listFleetAlerts({ status, kind });
  const openCount = await countOpenFleetAlerts();

  return NextResponse.json({ openCount, alerts });
}
