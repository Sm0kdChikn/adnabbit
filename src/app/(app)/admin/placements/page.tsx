import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PlacementBadge } from "@/components/StatusBadge";
import { PlacementActions } from "./PlacementActions";
import { formatVertical } from "@/lib/types";

export default async function AdminPlacementsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const pending = await prisma.placementRequest.findMany({
    where: { status: "REQUESTED" },
    orderBy: { createdAt: "asc" },
    include: {
      advertiser: { select: { email: true, name: true } },
      screen: {
        include: {
          host: { select: { name: true, vertical: true, otherLabel: true } },
        },
      },
      creative: {
        select: { id: true, name: true, fileName: true, storedName: true },
      },
    },
  });

  const recent = await prisma.placementRequest.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    orderBy: { reviewedAt: "desc" },
    take: 20,
    include: {
      advertiser: { select: { email: true, name: true } },
      screen: {
        include: {
          host: { select: { name: true, vertical: true, otherLabel: true } },
        },
      },
      creative: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Placement queue</h1>
          <p className="text-sm text-slate-600">
            Approve or reject REQUESTED placements (reject requires a reason).
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/admin"
            className="rounded-md bg-indigo-50 px-3 py-1.5 text-indigo-700 hover:bg-indigo-100"
          >
            Creatives
          </Link>
          <Link
            href="/admin/screens"
            className="rounded-md bg-indigo-50 px-3 py-1.5 text-indigo-700 hover:bg-indigo-100"
          >
            Screens
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Requested ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No pending placement requests.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {p.screen.name} ← {p.creative.name}
                      </h3>
                      <PlacementBadge status={p.status} />
                    </div>
                    <p className="text-sm text-slate-500">
                      By {p.advertiser.name || p.advertiser.email} · {p.screen.host.name} ·{" "}
                      {formatVertical(p.screen.host.vertical, p.screen.host.otherLabel)} ·{" "}
                      {p.screen.city} {p.screen.zip}
                    </p>
                    {p.note && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Note:</span> {p.note}
                      </p>
                    )}
                    <a
                      href={`/api/uploads/${p.creative.storedName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm text-indigo-600 hover:underline"
                    >
                      Preview creative
                    </a>
                  </div>
                  <PlacementActions placementId={p.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Recent decisions</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">No decisions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {recent.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <span className="font-medium text-slate-900">
                    {p.screen.name} ← {p.creative.name}
                  </span>
                  <span className="ml-2 text-sm text-slate-500">{p.advertiser.email}</span>
                  {p.status === "REJECTED" && p.rejectReason && (
                    <p className="text-xs text-rose-700">{p.rejectReason}</p>
                  )}
                </div>
                <PlacementBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
