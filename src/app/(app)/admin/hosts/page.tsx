import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatVertical } from "@/lib/types";
import {
  Card,
  CardList,
  CardListItem,
  EmptyState,
  PageHeader,
  ViewToggle,
} from "@/components/ui";

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
      <PageHeader
        title="Hosts"
        description="Venues with a primary vertical. Screens inherit vertical from their host."
        actions={
          <>
            <ViewToggle />
            <Link
              href="/admin/hosts/new"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent shadow-glow-sm hover:brightness-110"
            >
              New host
            </Link>
          </>
        }
      />

      {hosts.length === 0 ? (
        <EmptyState>
          No hosts yet.{" "}
          <Link href="/admin/hosts/new" className="text-accent hover:underline">
            Create one
          </Link>
          .
        </EmptyState>
      ) : (
        <CardList>
          {hosts.map((h) => (
            <CardListItem key={h.id}>
              <Card glow className="flex h-full flex-col p-4">
                <div className="flex flex-1 flex-col gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      href={`/admin/hosts/${h.id}`}
                      className="font-semibold text-accent hover:underline"
                    >
                      {h.name}
                    </Link>
                    <p className="text-sm text-muted">
                      {formatVertical(h.vertical, h.otherLabel)} · {h._count.screens}{" "}
                      screen{h._count.screens === 1 ? "" : "s"}
                      {" · "}
                      {h.user ? `owner ${h.user.email}` : "unclaimed"}
                    </p>
                    {h.notes && (
                      <p className="text-xs text-muted-strong">{h.notes}</p>
                    )}
                  </div>
                  <Link
                    href={`/admin/hosts/${h.id}`}
                    className="text-sm text-muted hover:text-accent"
                  >
                    Edit
                  </Link>
                </div>
              </Card>
            </CardListItem>
          ))}
        </CardList>
      )}
    </div>
  );
}
