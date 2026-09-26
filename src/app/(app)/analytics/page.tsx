import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  computeCampaigns,
  computeDaypartHeat,
  computeFill,
  parseAnalyticsDateRange,
  parseAnalyticsFilters,
  type AnalyticsScope,
} from "@/lib/analytics";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default async function AdvertiserAnalyticsPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    range?: string;
    screenId?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/analytics");
  if (session.user.role === "HOST") redirect("/host/analytics");
  if (session.user.role !== "ADVERTISER") redirect("/dashboard");

  const scope: AnalyticsScope = {
    role: "ADVERTISER",
    userId: session.user.id,
    advertiserId: session.user.id,
  };
  const range = parseAnalyticsDateRange(searchParams);
  const filters = parseAnalyticsFilters({
    screenId: searchParams.screenId,
    advertiserId: session.user.id,
  });

  const screenIds = (
    await prisma.schedule.findMany({
      where: { placement: { advertiserId: session.user.id } },
      select: { screenId: true },
      distinct: ["screenId"],
    })
  ).map((r) => r.screenId);

  const screens =
    screenIds.length === 0
      ? []
      : await prisma.screen.findMany({
          where: { id: { in: screenIds } },
          orderBy: [{ host: { name: "asc" } }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            host: { select: { name: true } },
          },
        });

  const [fill, heat, campaigns] = await Promise.all([
    computeFill(scope, range, filters),
    computeDaypartHeat(scope, range, filters),
    computeCampaigns(scope, filters),
  ]);

  return (
    <AnalyticsDashboard
      title="Campaign analytics"
      description="Your scheduled fill, daypart heat, and campaign windows. Not device plays (F2)."
      basePath="/analytics"
      exportBase="/api/analytics/export.csv"
      range={range}
      fillSummary={fill.summary}
      fillRows={fill.rows}
      heat={heat}
      campaigns={campaigns}
      screens={screens.map((s) => ({
        id: s.id,
        label: `${s.host.name} · ${s.name}`,
      }))}
      showScreenFilter
    />
  );
}
