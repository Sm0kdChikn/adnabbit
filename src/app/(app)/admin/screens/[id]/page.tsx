import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ScreenForm } from "../ScreenForm";
import { formatVertical } from "@/lib/types";
import { ClaimDevicePanel } from "@/components/ClaimDevicePanel";
import { RemoteViewPanel } from "@/components/RemoteViewPanel";
import { isDeviceRecentlySeen } from "@/lib/device";

export default async function EditScreenPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const screen = await prisma.screen.findUnique({
    where: { id: params.id },
    include: {
      host: { select: { id: true, name: true, vertical: true, otherLabel: true } },
      device: true,
    },
  });
  if (!screen) notFound();

  const hosts = await prisma.host.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, vertical: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/screens" className="text-sm text-accent hover:underline">
          ← Screens
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Edit screen</h1>
        <p className="text-sm text-muted">
          Host vertical (inherited):{" "}
          {formatVertical(screen.host.vertical, screen.host.otherLabel)}
        </p>
      </div>
      <ClaimDevicePanel
        screenId={screen.id}
        role="admin"
        device={
          screen.device
            ? {
                id: screen.device.id,
                name: screen.device.name,
                lastSeenAt: screen.device.lastSeenAt?.toISOString() ?? null,
                claimedAt: screen.device.claimedAt.toISOString(),
              }
            : null
        }
      />
      <RemoteViewPanel
        screenId={screen.id}
        hasDevice={!!screen.device}
        deviceOnline={isDeviceRecentlySeen(screen.device?.lastSeenAt)}
      />
      <ScreenForm
        mode="edit"
        screenId={screen.id}
        hosts={hosts}
        initial={{
          name: screen.name,
          city: screen.city,
          zip: screen.zip,
          inventoryStatus: screen.inventoryStatus,
          notes: screen.notes,
          hostId: screen.hostId,
        }}
      />
    </div>
  );
}
