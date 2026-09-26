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

export default async function HostAnalyticsPage({
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
  if (session.user.role === "ADVERTISER") redirect("/analytics");
  if (session.user.role !== "HOST") redirect("/dashboard");

  const host = await prisma.host.findUnique({
    where: { userId: session.user.id },
    include: {
      screens: {
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  if (!host) {
    redirect("/host");
  }

  const scope: AnalyticsScope = {
    role: "HOST",
    userId: session.user.id,
    hostId: host.id,
  };
  const range = parseAnalyticsDateRange(searchParams);
  const filters = parseAnalyticsFilters({
    screenId: searchParams.screenId,
    hostId: host.id,
  });

  const [fill, heat, campaigns] = await Promise.all([
    computeFill(scope, range, filters),
    computeDaypartHeat(scope, range, filters),
    computeCampaigns(scope, filters),
  ]);

  return (
    <AnalyticsDashboard
      title="Venue analytics"
      description={`${host.name} — fill vs closed hours, daypart heat, and campaigns on your screens.`}
      basePath="/host/analytics"
      exportBase="/api/host/analytics/export.csv"
      range={range}
      fillSummary={fill.summary}
      fillRows={fill.rows}
      heat={heat}
      campaigns={campaigns}
      screens={host.screens.map((s) => ({ id: s.id, label: s.name }))}
      showScreenFilter
    />
  );
}
