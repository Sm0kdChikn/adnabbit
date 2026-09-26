import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { listAuditEvents } from "@/lib/audit";

/**
 * Ticket W — read-only audit list. No POST/PATCH/DELETE (append-only via writers).
 * Soft miss: CSV export.
 */
export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || undefined;
  const actorUserId =
    url.searchParams.get("actor") ||
    url.searchParams.get("actorUserId") ||
    undefined;
  const targetType = url.searchParams.get("targetType") || undefined;
  const targetId = url.searchParams.get("targetId") || undefined;
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const limit = limitRaw ? Number(limitRaw) : 100;
  const offset = offsetRaw ? Number(offsetRaw) : 0;

  const result = await listAuditEvents({
    action,
    actorUserId,
    targetType,
    targetId,
    from,
    to,
    limit: Number.isFinite(limit) ? limit : 100,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return NextResponse.json(result);
}
