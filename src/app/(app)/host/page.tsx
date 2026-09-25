import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { InventoryBadge } from "@/components/StatusBadge";
import { formatVertical } from "@/lib/types";

export default async function HostPortalPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/hosts");
  if (session.user.role !== "HOST") redirect("/dashboard");

  const host = await prisma.host.findUnique({
    where: { userId: session.user.id },
    include: { screens: { orderBy: { name: "asc" } } },
  });

  if (!host) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Host portal</h1>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          No venue is linked to this account yet. Ask an AdNabbit admin to attach your
          login to a host.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{host.name}</h1>
          <p className="text-sm text-slate-600">
            {formatVertical(host.vertical, host.otherLabel)} · {host.timezone}
          </p>
          {host.notes && <p className="mt-1 text-sm text-slate-500">{host.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/host/edit"
            className="rounded-md bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100"
          >
            Edit venue
          </Link>
          <Link
            href="/host/screens/new"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add screen
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Your screens ({host.screens.length})
        </h2>
        {host.screens.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No screens yet.{" "}
            <Link href="/host/screens/new" className="text-indigo-600 hover:underline">
              Add one
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
            {host.screens.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/host/screens/${s.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {s.name}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {s.city}, {s.zip}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <InventoryBadge status={s.inventoryStatus} />
                  <Link
                    href={`/host/screens/${s.id}`}
                    className="text-sm text-slate-600 hover:text-indigo-600"
                  >
                    Manage
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400">
        Placement approve/reject and scheduling stay with AdNabbit admins. You can view
        placements and schedules on each screen (read-only).
      </p>
    </div>
  );
}
