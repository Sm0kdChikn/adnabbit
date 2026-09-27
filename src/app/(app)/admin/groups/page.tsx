import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { listDeviceGroups } from "@/lib/device-groups";
import { GroupsBoard } from "./GroupsBoard";

export const dynamic = "force-dynamic";

export default async function AdminGroupsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const groups = await listDeviceGroups();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Device groups"
        description={
          <>
            Flat admin groups of <strong>paired</strong> devices. Use for fleet
            filter and bulk refresh / reboot / kiosk / setOutput. Soft miss:
            nested groups, host-owned groups.
          </>
        }
        actions={
          <Link
            href="/admin/fleet"
            className="rounded-md border border-border bg-accent-dim px-3 py-1.5 text-sm text-accent hover:border-accent/40"
          >
            Fleet
          </Link>
        }
      />
      <GroupsBoard groups={groups} />
    </div>
  );
}
