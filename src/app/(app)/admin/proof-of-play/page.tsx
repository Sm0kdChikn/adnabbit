import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { ImportForm } from "./ImportForm";
import { PopFilters } from "./PopFilters";
import { buildPlayEventWhere, formatDurationTotal } from "@/lib/pop";

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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Proof of play</h1>
        <p className="text-sm text-slate-600">
          Import OptiSigns PoP CSVs and filter play events. Host filler is excluded by default.
        </p>
      </div>

      <ImportForm />

      {imports.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-800">Recent imports</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
            {imports.map((imp) => (
              <li key={imp.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span>
                  <span className="font-medium text-slate-900">{imp.filename}</span>
                  <span className="ml-2 text-slate-500">
                    {imp.insertedCount} in / {imp.skippedDupes} skip · {imp.rowCount} rows ·{" "}
                    {imp.uploadedBy.email}
                  </span>
                </span>
                <span className="text-slate-400">
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
        <span>
          <strong>{count}</strong> event{count === 1 ? "" : "s"}
          {count > events.length ? ` (showing ${events.length})` : ""}
        </span>
        <span>
          Duration total: <strong>{formatDurationTotal(totalSec)}</strong>
        </span>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No play events match. Import a CSV or adjust filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
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
            <tbody className="divide-y divide-slate-100">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {e.startTimeUtc.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{e.screenName}</div>
                    <div className="text-xs text-slate-400">{e.screenUuid.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-900">{e.assetName}</div>
                    <div className="text-xs text-slate-400">{e.assetId}</div>
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-2 text-xs text-slate-500">
                    {e.screenTags || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{e.durationSec}s</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {e.creative ? (
                      <>
                        {e.creative.name}
                        <div className="text-slate-400">{e.creative.advertiser.email}</div>
                      </>
                    ) : (
                      <span className="text-slate-400">unmatched</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {e.isHostFiller ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        filler
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
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
