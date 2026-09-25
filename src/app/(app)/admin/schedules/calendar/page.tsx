import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import { materializeEndedSchedules } from "@/lib/schedules";
import { ScheduleCalendar } from "@/components/calendar/ScheduleCalendar";
import type { CalendarScheduleInput } from "@/lib/calendar-expand";

export default async function AdminSchedulesCalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  await materializeEndedSchedules();

  const rows = await prisma.schedule.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      placement: {
        include: {
          creative: { select: { name: true } },
          advertiser: { select: { email: true, name: true } },
        },
      },
      screen: {
        include: { host: { select: { name: true, timezone: true } } },
      },
    },
  });

  const schedules: CalendarScheduleInput[] = rows.map((s) => ({
    id: s.id,
    kind: s.kind,
    status: s.status,
    screenId: s.screenId,
    startAt: s.startAt ? s.startAt.toISOString() : null,
    endAt: s.endAt ? s.endAt.toISOString() : null,
    weekdays: s.weekdays,
    startTime: s.startTime,
    endTime: s.endTime,
    campaignStartDate: s.campaignStartDate,
    campaignEndDate: s.campaignEndDate,
    note: s.note,
    screen: {
      name: s.screen.name,
      host: { name: s.screen.host.name, timezone: s.screen.host.timezone },
    },
    placement: {
      creative: { name: s.placement.creative.name },
      advertiser: {
        name: s.placement.advertiser.name,
        email: s.placement.advertiser.email,
      },
    },
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule calendar</h1>
          <p className="text-sm text-muted">
            Week / month view of ACTIVE + DRAFT schedules (host timezone). Click a block to edit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/schedules"
            className="rounded-md bg-surface-hover px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
          >
            List view
          </Link>
          <Link
            href="/admin/schedules/new"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-brand-bg hover:brightness-110"
          >
            New schedule
          </Link>
        </div>
      </div>

      <Suspense fallback={<p className="text-sm text-muted">Loading calendar…</p>}>
        <ScheduleCalendar
          schedules={schedules}
          basePath="/admin/schedules/calendar"
          detailBasePath="/admin/schedules"
        />
      </Suspense>
    </div>
  );
}
