import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, ViewToggle } from "@/components/ui";
import {
  FolderBoard,
  type AdvertiserFolderItem,
  type FolderDto,
} from "@/components/admin/FolderBoard";

export default async function AdminAdvertisersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [advertisersRaw, foldersRaw] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADVERTISER" },
      orderBy: { email: "asc" },
      include: {
        _count: { select: { creatives: true } },
        profile: { select: { slug: true, displayName: true, published: true } },
      },
    }),
    prisma.adminFolder.findMany({
      where: { scope: "ADVERTISER" },
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

  const advertisers: AdvertiserFolderItem[] = advertisersRaw.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    creativeCount: a._count.creatives,
    profileSlug: a.profile?.slug ?? null,
    profilePublished: a.profile?.published ?? false,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Advertisers"
        description="Advertiser accounts. Organize into admin folders (drag-and-drop). Folders are admin-only — advertiser portals are unchanged."
        actions={<ViewToggle />}
      />

      <FolderBoard
        scope="ADVERTISER"
        folders={folders}
        advertisers={advertisers}
        emptyLabel="No advertiser accounts yet."
      />
    </div>
  );
}
