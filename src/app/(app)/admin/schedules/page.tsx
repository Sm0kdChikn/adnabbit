import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import { ScheduleBadge } from "@/components/StatusBadge";
import { materializeEndedSchedules } from "@/lib/schedules";
import { isScheduleStatus } from "@/lib/types";
import { ScheduleFilters } from "./ScheduleFilters";

export default async function AdminSchedulesPage({
  searchParams,
}: {
  searchParams: { screenId?: string; status?: string; from?: string; to?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  await materializeEndedSchedules();

  const screenId = searchParams.screenId?.trim() || "";
  const status = searchParams.status?.trim() || "";
  const from = searchParams.from?.trim() || "";
  const to = searchParams.to?.trim() || "";

  const where: Record<string, unknown> = {};
  if (screenId) where.screenId = screenId;
  if (status && isScheduleStatus(status)) where.status = status;
  if (from || to) {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && toDate && !Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      where.startAt = { lt: toDate };
      where.endAt = { gt: fromDate };
    } else if (fromDate && !Number.isNaN(fromDate.getTime())) {
      where.endAt = { gt: fromDate };
    } else if (toDate && !Number.isNaN(toDate.getTime())) {
      where.startAt = { lt: toDate };
    }
  }

  const [schedules, screens] = await Promise.all([
    prisma.schedule.findMany({
      where,
      orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
      include: {
        placement: {
          include: {
            advertiser: { select: { email: true, name: true } },
            creative: { select: { name: true } },
          },
        },
        screen: {
          include: { host: { select: { name: true } } },
        },
      },
    }),
    prisma.screen.findMany({
      orderBy: { name: "asc" },
      include: { host: { select: { name: true } } },
    }),
  ]);

  const screenOpts = screens.map((s) => ({
    id: s.id,
    name: s.name,
    hostName: s.host.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedules</h1>
          <p className="text-sm text-slate-600">
            Create windows for APPROVED placements. ACTIVE schedules past endAt become ENDED on
            load.
          </p>
        </div>
        <Link
          href="/admin/schedules/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New schedule
        </Link>
      </div>

      <Suspense fallback={null}>
        <ScheduleFilters screens={screenOpts} />
      </Suspense>

      {schedules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No schedules match.{" "}
          <Link href="/admin/schedules/new" className="text-indigo-600 hover:underline">
            Create one
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">
                      {s.screen.host.name} · {s.screen.name}
                    </h2>
                    <ScheduleBadge status={s.status} />
                  </div>
                  <p className="text-sm text-slate-600">
                    {s.placement.creative.name} ·{" "}
                    {s.placement.advertiser.name || s.placement.advertiser.email}
                  </p>
                  <p className="text-sm text-slate-500">
                    {new Date(s.startAt).toLocaleString()} → {new Date(s.endAt).toLocaleString()}
                  </p>
                  {s.note && <p className="text-sm text-slate-500">Note: {s.note}</p>}
                </div>
                <Link
                  href={`/admin/schedules/${s.id}`}
                  className="rounded-md bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100"
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
