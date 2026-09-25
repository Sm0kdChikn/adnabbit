import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ScheduleBadge } from "@/components/StatusBadge";
import { formatScheduleSummary, materializeEndedSchedules } from "@/lib/schedules";
import { formatVertical } from "@/lib/types";

export default async function AdvertiserSchedulesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/schedules");
  if (session.user.role === "HOST") redirect("/host");


  await materializeEndedSchedules();

  const schedules = await prisma.schedule.findMany({
    where: { placement: { advertiserId: session.user.id } },
    orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
    include: {
      placement: {
        include: {
          creative: { select: { name: true } },
        },
      },
      screen: {
        include: { host: { select: { name: true, vertical: true, otherLabel: true, timezone: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My schedules</h1>
          <p className="text-sm text-muted">
            Read-only view of play windows for your approved placements.
          </p>
        </div>
        <Link
          href="/schedules/calendar"
          className="rounded-md bg-surface-hover px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
        >
          Calendar
        </Link>
      </div>

      {schedules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          No schedules yet. After admin schedules an approved placement, it appears here.{" "}
          <Link href="/placements" className="text-accent hover:underline">
            View placements
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {schedules.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-foreground">
                  {s.screen.host.name} · {s.screen.name}
                </h2>
                <ScheduleBadge status={s.status} />
              </div>
              <p className="text-sm text-muted">
                {s.placement.creative.name} ·{" "}
                {formatVertical(s.screen.host.vertical, s.screen.host.otherLabel)} ·{" "}
                {s.screen.city} {s.screen.zip}
              </p>
              <p className="text-sm text-muted">
                <span className="mr-2 rounded bg-surface-hover px-1.5 py-0.5 text-xs font-medium text-muted">
                  {s.kind}
                </span>
                {formatScheduleSummary(s, s.screen.host.timezone)}
              </p>
              {s.note && <p className="text-sm text-muted">Note: {s.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
