import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { HostScreenForm } from "../HostScreenForm";
import { PlacementBadge, StatusBadge } from "@/components/StatusBadge";

export default async function HostScreenDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "HOST") redirect("/dashboard");

  const host = await prisma.host.findUnique({
    where: { userId: session.user.id },
  });
  if (!host) notFound();

  const screen = await prisma.screen.findFirst({
    where: { id: params.id, hostId: host.id },
    include: {
      placementRequests: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          creative: { select: { name: true } },
          advertiser: { select: { email: true, name: true } },
        },
      },
      schedules: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          placement: {
            include: { creative: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!screen) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/host" className="text-sm text-indigo-600 hover:underline">
          ← Host portal
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Edit screen</h1>
        <p className="text-sm text-slate-600">{screen.name}</p>
      </div>

      <HostScreenForm
        mode="edit"
        screenId={screen.id}
        initial={{
          name: screen.name,
          city: screen.city,
          zip: screen.zip,
          inventoryStatus: screen.inventoryStatus,
          notes: screen.notes,
        }}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Placements (read-only)
        </h2>
        {screen.placementRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No placement requests on this screen.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {screen.placementRequests.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{p.creative.name}</p>
                  <p className="text-sm text-slate-500">
                    {p.advertiser.name || p.advertiser.email}
                  </p>
                </div>
                <PlacementBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Schedules (read-only)
        </h2>
        {screen.schedules.length === 0 ? (
          <p className="text-sm text-slate-500">No schedules on this screen.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {screen.schedules.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {s.placement.creative.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {s.kind}
                    {s.kind === "RECURRING"
                      ? ` · ${s.weekdays} · ${s.startTime}–${s.endTime}`
                      : s.startAt && s.endAt
                        ? ` · ${s.startAt.toISOString().slice(0, 10)} → ${s.endAt.toISOString().slice(0, 10)}`
                        : ""}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
