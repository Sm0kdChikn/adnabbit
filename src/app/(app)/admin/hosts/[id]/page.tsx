import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { HostForm } from "../HostForm";
import { InventoryBadge } from "@/components/StatusBadge";
import { formatVertical } from "@/lib/types";
import { AttachOwnerForm } from "../AttachOwnerForm";

export default async function EditHostPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const host = await prisma.host.findUnique({
    where: { id: params.id },
    include: {
      screens: { orderBy: { name: "asc" } },
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!host) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/hosts" className="text-sm text-indigo-600 hover:underline">
          ← Hosts
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Edit host</h1>
        <p className="text-sm text-slate-600">
          Vertical: {formatVertical(host.vertical, host.otherLabel)}
        </p>
      </div>

      <HostForm
        mode="edit"
        hostId={host.id}
        initial={{
          name: host.name,
          vertical: host.vertical,
          otherLabel: host.otherLabel,
          notes: host.notes,
          timezone: host.timezone,
        }}
      />

      <AttachOwnerForm hostId={host.id} current={host.user} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            Screens ({host.screens.length})
          </h2>
          <Link
            href={`/admin/screens/new?hostId=${host.id}`}
            className="text-sm text-indigo-600 hover:underline"
          >
            Add screen
          </Link>
        </div>
        {host.screens.length === 0 ? (
          <p className="text-sm text-slate-500">No screens on this host yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {host.screens.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/admin/screens/${s.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {s.name}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {s.city}, {s.zip}
                  </p>
                </div>
                <InventoryBadge status={s.inventoryStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
