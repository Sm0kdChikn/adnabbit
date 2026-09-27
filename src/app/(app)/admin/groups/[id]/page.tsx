import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getDeviceGroupDetail } from "@/lib/device-groups";
import { prisma } from "@/lib/prisma";
import { GroupDetailClient } from "./GroupDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminGroupDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const group = await getDeviceGroupDetail(params.id);
  if (!group) notFound();

  const paired = await prisma.device.findMany({
    orderBy: [{ screen: { city: "asc" } }, { screen: { name: "asc" } }],
    select: {
      id: true,
      screen: {
        select: {
          id: true,
          name: true,
          city: true,
          host: { select: { name: true } },
        },
      },
    },
  });

  const pairedOptions = paired.map((d) => ({
    deviceId: d.id,
    screenId: d.screen.id,
    screenName: d.screen.name,
    hostName: d.screen.host.name,
    city: d.screen.city,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={group.name}
        description={
          <>
            {group.memberCount} paired device
            {group.memberCount === 1 ? "" : "s"}. Unpaired screens cannot be
            added.
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/groups"
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:border-accent/40 hover:text-accent"
            >
              All groups
            </Link>
            <Link
              href={`/admin/fleet?groupId=${group.id}`}
              className="rounded-md border border-border bg-accent-dim px-3 py-1.5 text-sm text-accent hover:border-accent/40"
            >
              Fleet
            </Link>
          </div>
        }
      />
      <GroupDetailClient group={group} pairedOptions={pairedOptions} />
    </div>
  );
}
