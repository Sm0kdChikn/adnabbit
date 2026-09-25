import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPlayEventWhere, playEventsToCsv } from "@/lib/pop";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADVERTISER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownCreativeIds = (
    await prisma.creative.findMany({
      where: { advertiserId: session.user.id },
      select: { id: true },
    })
  ).map((c) => c.id);

  const url = new URL(req.url);
  const where = buildPlayEventWhere(
    {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      screen: url.searchParams.get("screen"),
      asset: url.searchParams.get("asset"),
      screenTags: url.searchParams.get("screenTags"),
      includeFiller: url.searchParams.get("includeFiller"),
    },
    {
      creativeId: { in: ownCreativeIds.length ? ownCreativeIds : ["__none__"] },
    }
  );

  const events = await prisma.playEvent.findMany({
    where,
    orderBy: { startTimeUtc: "desc" },
  });

  const csv = playEventsToCsv(events);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pop-report.csv"`,
    },
  });
}
