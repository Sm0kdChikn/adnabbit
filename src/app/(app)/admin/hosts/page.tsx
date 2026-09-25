import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatVertical } from "@/lib/types";

export default async function AdminHostsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const hosts = await prisma.host.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { screens: true } },
      user: { select: { email: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hosts</h1>
          <p className="text-sm text-slate-600">
            Venues with a primary vertical. Screens inherit vertical from their host.
          </p>
        </div>
        <Link
          href="/admin/hosts/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New host
        </Link>
      </div>

      {hosts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No hosts yet.{" "}
          <Link href="/admin/hosts/new" className="text-indigo-600 hover:underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {hosts.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <Link
                  href={`/admin/hosts/${h.id}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {h.name}
                </Link>
                <p className="text-sm text-slate-500">
                  {formatVertical(h.vertical, h.otherLabel)} · {h._count.screens} screen
                  {h._count.screens === 1 ? "" : "s"}
                  {" · "}
                  {h.user ? `owner ${h.user.email}` : "unclaimed"}
                </p>
                {h.notes && <p className="text-xs text-slate-400">{h.notes}</p>}
              </div>
              <Link
                href={`/admin/hosts/${h.id}`}
                className="text-sm text-slate-600 hover:text-indigo-600"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
