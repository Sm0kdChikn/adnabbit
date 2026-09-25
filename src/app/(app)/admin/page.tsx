import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewActions } from "./ReviewActions";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const pending = await prisma.creative.findMany({
    where: { status: "PENDING" },
    orderBy: { updatedAt: "asc" },
    include: { advertiser: { select: { email: true, name: true } } },
  });

  const recent = await prisma.creative.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    orderBy: { reviewedAt: "desc" },
    take: 20,
    include: { advertiser: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin review queue</h1>
          <p className="text-sm text-slate-600">Approve or reject PENDING creatives.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <a href="/admin/hosts" className="rounded-md bg-indigo-50 px-3 py-1.5 text-indigo-700 hover:bg-indigo-100">
            Hosts
          </a>
          <a href="/admin/screens" className="rounded-md bg-indigo-50 px-3 py-1.5 text-indigo-700 hover:bg-indigo-100">
            Screens
          </a>
          <a href="/admin/placements" className="rounded-md bg-indigo-50 px-3 py-1.5 text-indigo-700 hover:bg-indigo-100">
            Placements
          </a>
          <a href="/admin/schedules" className="rounded-md bg-indigo-50 px-3 py-1.5 text-indigo-700 hover:bg-indigo-100">
            Schedules
          </a>
          <a href="/admin/profiles" className="rounded-md bg-indigo-50 px-3 py-1.5 text-indigo-700 hover:bg-indigo-100">
            Profiles
          </a>
          <a href="/admin/proof-of-play" className="rounded-md bg-indigo-50 px-3 py-1.5 text-indigo-700 hover:bg-indigo-100">
            Proof of play
          </a>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No pending creatives.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{c.name}</h3>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-sm text-slate-500">
                      By {c.advertiser.name || c.advertiser.email} · {c.fileName} ·{" "}
                      {(c.fileSize / 1024).toFixed(1)} KB
                    </p>
                    {c.notes && <p className="text-sm text-slate-600">{c.notes}</p>}
                    <a
                      href={`/api/uploads/${c.storedName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm text-indigo-600 hover:underline"
                    >
                      Preview file
                    </a>
                  </div>
                  <ReviewActions creativeId={c.id} />
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
            {recent.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <span className="ml-2 text-sm text-slate-500">
                    {c.advertiser.email}
                  </span>
                  {c.status === "REJECTED" && c.rejectReason && (
                    <p className="text-xs text-rose-700">{c.rejectReason}</p>
                  )}
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
