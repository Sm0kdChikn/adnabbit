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

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    range?: string;
    hostId?: string;
    screenId?: string;
    advertiserId?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host/analytics");
  if (session.user.role === "ADVERTISER") redirect("/analytics");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const scope: AnalyticsScope = {
    role: "ADMIN",
    userId: session.user.id,
  };
  const range = parseAnalyticsDateRange(searchParams);
  const filters = parseAnalyticsFilters(searchParams);

  const [fill, heat, campaigns, hosts, screens, advertisers] = await Promise.all([
    computeFill(scope, range, filters),
    computeDaypartHeat(scope, range, filters),
    computeCampaigns(scope, filters),
    prisma.host.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.screen.findMany({
      orderBy: [{ host: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        host: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "ADVERTISER" },
      orderBy: { email: "asc" },
      select: { id: true, email: true, name: true },
    }),
  ]);

  return (
    <AnalyticsDashboard
      title="Marketplace analytics"
      description="Schedule fill, daypart heat, and campaign windows across the network. Not device plays (F2)."
      basePath="/admin/analytics"
      exportBase="/api/admin/analytics/export.csv"
      range={range}
      fillSummary={fill.summary}
      fillRows={fill.rows}
      heat={heat}
      campaigns={campaigns}
      hosts={hosts.map((h) => ({ id: h.id, label: h.name }))}
      screens={screens.map((s) => ({
        id: s.id,
        label: `${s.host.name} · ${s.name}`,
      }))}
      advertisers={advertisers.map((a) => ({
        id: a.id,
        label: a.name ? `${a.name} (${a.email})` : a.email,
      }))}
      showHostFilter
      showScreenFilter
      showAdvertiserFilter
    />
  );
}
