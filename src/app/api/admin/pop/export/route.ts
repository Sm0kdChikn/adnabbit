import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildPlayEventWhere, playEventsToCsv } from "@/lib/pop";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const where = buildPlayEventWhere({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    screen: url.searchParams.get("screen"),
    asset: url.searchParams.get("asset"),
    screenTags: url.searchParams.get("screenTags"),
    includeFiller: url.searchParams.get("includeFiller"),
  });

  const events = await prisma.playEvent.findMany({
    where,
    orderBy: { startTimeUtc: "desc" },
  });

  const csv = playEventsToCsv(events);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pop-report-admin.csv"`,
    },
  });
}
