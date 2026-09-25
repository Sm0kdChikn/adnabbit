import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PlacementBadge } from "@/components/StatusBadge";
import { formatVertical } from "@/lib/types";

export default async function PlacementsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/placements");
  if (session.user.role === "HOST") redirect("/host");


  const placements = await prisma.placementRequest.findMany({
    where: { advertiserId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      screen: {
        include: {
          host: { select: { name: true, vertical: true, otherLabel: true } },
        },
      },
      creative: { select: { id: true, name: true, storedName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Placement requests</h1>
          <p className="text-sm text-slate-600">
            Track status. Rejected requests show the admin reason.
          </p>
        </div>
        <Link
          href="/screens"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Browse screens
        </Link>
      </div>

      {placements.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No placement requests yet.{" "}
          <Link href="/screens" className="text-indigo-600 hover:underline">
            Browse screens
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {placements.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">
                      {p.screen.name} · {p.creative.name}
                    </h2>
                    <PlacementBadge status={p.status} />
                  </div>
                  <p className="text-sm text-slate-600">
                    {p.screen.host.name} ·{" "}
                    {formatVertical(p.screen.host.vertical, p.screen.host.otherLabel)} ·{" "}
                    {p.screen.city} {p.screen.zip}
                  </p>
                  {p.note && (
                    <p className="text-sm text-slate-500">
                      <span className="font-medium">Your note:</span> {p.note}
                    </p>
                  )}
                  {p.status === "REJECTED" && p.rejectReason && (
                    <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      <span className="font-medium">Rejection reason:</span> {p.rejectReason}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    Requested {new Date(p.createdAt).toLocaleString()}
                    {p.reviewedAt &&
                      ` · Reviewed ${new Date(p.reviewedAt).toLocaleString()}`}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
