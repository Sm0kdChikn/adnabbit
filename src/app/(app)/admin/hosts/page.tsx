import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatVertical } from "@/lib/types";
import { PageHeader, ViewToggle } from "@/components/ui";
import {
  FolderBoard,
  type FolderDto,
  type HostFolderItem,
} from "@/components/admin/FolderBoard";

export default async function AdminHostsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [hostsRaw, foldersRaw] = await Promise.all([
    prisma.host.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { screens: true } },
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.adminFolder.findMany({
      where: { scope: "HOST" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
    }),
  ]);

  const folders: FolderDto[] = foldersRaw.map((f) => ({
    id: f.id,
    scope: f.scope,
    name: f.name,
    sortOrder: f.sortOrder,
    items: f.items.map((i) => ({
      id: i.id,
      targetId: i.targetId,
      sortOrder: i.sortOrder,
    })),
  }));

  const hosts: HostFolderItem[] = hostsRaw.map((h) => ({
    id: h.id,
    name: h.name,
    verticalLabel: formatVertical(h.vertical, h.otherLabel),
    screenCount: h._count.screens,
    ownerEmail: h.user?.email ?? null,
    notes: h.notes,
    playbackTakenDownAt: h.playbackTakenDownAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hosts"
        description="Venues with a primary vertical. Organize into admin folders (drag-and-drop). Screens inherit vertical from their host."
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

      <FolderBoard
        scope="HOST"
        folders={folders}
        hosts={hosts}
        emptyLabel={
          <>
            No hosts yet.{" "}
            <Link href="/admin/hosts/new" className="text-accent hover:underline">
              Create one
            </Link>
            .
          </>
        }
      />
    </div>
  );
}
