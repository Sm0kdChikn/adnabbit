import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { ImportForm } from "./ImportForm";
import { PopFilters } from "./PopFilters";
import { buildPlayEventWhere, formatDurationTotal } from "@/lib/pop";
import { PageHeader } from "@/components/ui";

export default async function AdminProofOfPlayPage({
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
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const where = buildPlayEventWhere({
    from: searchParams.from,
    to: searchParams.to,
    screen: searchParams.screen,
    asset: searchParams.asset,
    screenTags: searchParams.screenTags,
    includeFiller: searchParams.includeFiller,
  });

  const [events, imports, agg] = await Promise.all([
    prisma.playEvent.findMany({
      where,
      orderBy: { startTimeUtc: "desc" },
      take: 500,
      include: {
        creative: { select: { id: true, name: true, advertiser: { select: { email: true } } } },
      },
    }),
    prisma.playImport.findMany({
      orderBy: { importedAt: "desc" },
      take: 10,
      include: { uploadedBy: { select: { email: true } } },
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
      <PageHeader
        title="Proof of play"
        description="Import OptiSigns PoP CSVs and filter play events. Host filler is excluded by default."
      />

      <ImportForm />

      {imports.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Recent imports</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm shadow-sm">
            {imports.map((imp) => (
              <li key={imp.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span>
                  <span className="font-medium text-foreground">{imp.filename}</span>
                  <span className="ml-2 text-muted">
                    {imp.insertedCount} in / {imp.skippedDupes} skip · {imp.rowCount} rows ·{" "}
                    {imp.uploadedBy.email}
                  </span>
                </span>
                <span className="text-muted-strong">
                  {imp.importedAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Suspense fallback={null}>
        <PopFilters basePath="/admin/proof-of-play" />
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
          No play events match. Import a CSV or adjust filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-background-elevated text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Start UTC</th>
                <th className="px-3 py-2">Screen</th>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Dur</th>
                <th className="px-3 py-2">Creative</th>
                <th className="px-3 py-2">Flags</th>
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
                    <div className="text-xs text-muted-strong">{e.screenUuid.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-foreground">{e.assetName}</div>
                    <div className="text-xs text-muted-strong">{e.assetId}</div>
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-2 text-xs text-muted">
                    {e.screenTags || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted">{e.durationSec}s</td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {e.creative ? (
                      <>
                        {e.creative.name}
                        <div className="text-muted-strong">{e.creative.advertiser.email}</div>
                      </>
                    ) : (
                      <span className="text-muted-strong">unmatched</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {e.isHostFiller ? (
                      <span className="rounded bg-[var(--status-warning-bg)] px-1.5 py-0.5 text-xs text-[var(--status-warning-fg)]">
                        filler
                      </span>
                    ) : (
                      <span className="text-xs text-muted-strong">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
