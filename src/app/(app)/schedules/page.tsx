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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My schedules</h1>
        <p className="text-sm text-slate-600">
          Read-only view of play windows for your approved placements.
        </p>
      </div>

      {schedules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No schedules yet. After admin schedules an approved placement, it appears here.{" "}
          <Link href="/placements" className="text-indigo-600 hover:underline">
            View placements
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {schedules.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-slate-900">
                  {s.screen.host.name} · {s.screen.name}
                </h2>
                <ScheduleBadge status={s.status} />
              </div>
              <p className="text-sm text-slate-600">
                {s.placement.creative.name} ·{" "}
                {formatVertical(s.screen.host.vertical, s.screen.host.otherLabel)} ·{" "}
                {s.screen.city} {s.screen.zip}
              </p>
              <p className="text-sm text-slate-500">
                <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                  {s.kind}
                </span>
                {formatScheduleSummary(s, s.screen.host.timezone)}
              </p>
              {s.note && <p className="text-sm text-slate-500">Note: {s.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
