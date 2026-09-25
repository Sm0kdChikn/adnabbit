import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ScheduleCreateForm } from "../ScheduleForm";
import { formatVertical } from "@/lib/types";

export default async function NewSchedulePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const approved = await prisma.placementRequest.findMany({
    where: { status: "APPROVED" },
    orderBy: { reviewedAt: "desc" },
    include: {
      advertiser: { select: { email: true, name: true } },
      creative: { select: { name: true } },
      screen: {
        include: { host: { select: { name: true, vertical: true, otherLabel: true } } },
      },
    },
  });

  const placements = approved.map((p) => ({
    id: p.id,
    label: `${p.screen.host.name} · ${p.screen.name} ← ${p.creative.name} (${p.advertiser.email}) · ${formatVertical(p.screen.host.vertical, p.screen.host.otherLabel)}`,
  }));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/admin/schedules" className="text-sm text-accent hover:underline">
          ← Schedules
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">New schedule</h1>
        <p className="text-sm text-muted">
          Only APPROVED placements. Overlapping ACTIVE on the same screen warns first (not a hard
          block).
        </p>
      </div>
      <ScheduleCreateForm placements={placements} />
    </div>
  );
}
