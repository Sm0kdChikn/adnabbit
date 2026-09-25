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
          <h1 className="text-2xl font-bold text-foreground">Hosts</h1>
          <p className="text-sm text-muted">
            Venues with a primary vertical. Screens inherit vertical from their host.
          </p>
        </div>
        <Link
          href="/admin/hosts/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110"
        >
          New host
        </Link>
      </div>

      {hosts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          No hosts yet.{" "}
          <Link href="/admin/hosts/new" className="text-accent hover:underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface shadow-sm">
          {hosts.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <Link
                  href={`/admin/hosts/${h.id}`}
                  className="font-medium text-accent hover:underline"
                >
                  {h.name}
                </Link>
                <p className="text-sm text-muted">
                  {formatVertical(h.vertical, h.otherLabel)} · {h._count.screens} screen
                  {h._count.screens === 1 ? "" : "s"}
                  {" · "}
                  {h.user ? `owner ${h.user.email}` : "unclaimed"}
                </p>
                {h.notes && <p className="text-xs text-muted-strong">{h.notes}</p>}
              </div>
              <Link
                href={`/admin/hosts/${h.id}`}
                className="text-sm text-muted hover:text-accent"
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
