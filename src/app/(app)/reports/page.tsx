import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { PopFilters } from "../admin/proof-of-play/PopFilters";
import { buildPlayEventWhere, formatDurationTotal } from "@/lib/pop";

export default async function AdvertiserReportsPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    screen?: string;
    asset?: string;
    screenTags?: string;
    includeFiller?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/proof-of-play");
  if (session.user.role === "HOST") redirect("/host");

  if (session.user.role !== "ADVERTISER") redirect("/dashboard");

  const ownCreatives = await prisma.creative.findMany({
    where: { advertiserId: session.user.id },
    select: { id: true },
  });
  const ownIds = ownCreatives.map((c) => c.id);

  const where = buildPlayEventWhere(
    {
      from: searchParams.from,
      to: searchParams.to,
      screen: searchParams.screen,
      asset: searchParams.asset,
      screenTags: searchParams.screenTags,
      includeFiller: searchParams.includeFiller,
    },
    {
      // Unmatched assets never shown to advertisers
      creativeId: { in: ownIds.length ? ownIds : ["__none__"] },
    }
  );

  const [events, agg] = await Promise.all([
    prisma.playEvent.findMany({
      where,
      orderBy: { startTimeUtc: "desc" },
      take: 500,
      include: { creative: { select: { id: true, name: true } } },
    }),
    prisma.playEvent.aggregate({
      where,
      _sum: { durationSec: true },
      _count: true,
    }),
  ]);

  const totalSec = agg._sum.durationSec ?? 0;
  const count = agg._count;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Proof of play</h1>
        <p className="text-sm text-muted">
          Plays matched to your creatives (by asset name). Unmatched OptiSigns assets are hidden.
          Host filler is excluded by default.
        </p>
      </div>

      <Suspense fallback={null}>
        <PopFilters basePath="/reports" />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent-dim px-4 py-3 text-sm text-accent">
        <span>
          <strong>{count}</strong> event{count === 1 ? "" : "s"}
          {count > events.length ? ` (showing ${events.length})` : ""}
        </span>
        <span>
          Duration total: <strong>{formatDurationTotal(totalSec)}</strong>
        </span>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          No matched play events yet. Plays appear here once an admin imports OptiSigns PoP data
          that matches your creative names.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-background-elevated text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Start UTC</th>
                <th className="px-3 py-2">Screen</th>
                <th className="px-3 py-2">Asset / Creative</th>
                <th className="px-3 py-2">Screen tags</th>
                <th className="px-3 py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-background-elevated">
                  <td className="whitespace-nowrap px-3 py-2 text-muted">
                    {e.startTimeUtc.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{e.screenName}</div>
                    <div className="text-xs text-muted-strong">{e.deviceTimezone || e.deviceLocalTime}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{e.creative?.name || e.assetName}</div>
                    <div className="text-xs text-muted-strong">{e.assetId}</div>
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-muted">
                    {e.screenTags || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted">{e.durationSec}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
