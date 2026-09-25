import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ScreenForm } from "../ScreenForm";

export default async function NewScreenPage({
  searchParams,
}: {
  searchParams: { hostId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const hosts = await prisma.host.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, vertical: true },
  });

  const preferredHostId =
    searchParams.hostId && hosts.some((h) => h.id === searchParams.hostId)
      ? searchParams.hostId
      : hosts[0]?.id;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/screens" className="text-sm text-accent hover:underline">
          ← Screens
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">New screen</h1>
      </div>
      {hosts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          Create a{" "}
          <Link href="/admin/hosts/new" className="text-accent hover:underline">
            host
          </Link>{" "}
          first.
        </p>
      ) : (
        <ScreenForm
          mode="create"
          hosts={hosts}
          initial={
            preferredHostId
              ? {
                  name: "",
                  city: "",
                  zip: "",
                  inventoryStatus: "OPEN",
                  notes: null,
                  hostId: preferredHostId,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
