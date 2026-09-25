import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ScheduleBadge } from "@/components/StatusBadge";
import { formatScheduleSummary, materializeEndedSchedules } from "@/lib/schedules";
import { ScheduleEditForm } from "../ScheduleEditForm";
import { formatVertical } from "@/lib/types";

export default async function AdminScheduleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  await materializeEndedSchedules([params.id]);

  const schedule = await prisma.schedule.findUnique({
    where: { id: params.id },
    include: {
      placement: {
        include: {
          advertiser: { select: { email: true, name: true } },
          creative: { select: { name: true, storedName: true } },
        },
      },
      screen: {
        include: {
          host: {
            select: {
              name: true,
              vertical: true,
              otherLabel: true,
              timezone: true,
            },
          },
        },
      },
      createdBy: { select: { email: true, name: true } },
    },
  });
  if (!schedule) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/admin/schedules" className="text-sm text-indigo-600 hover:underline">
          ← Schedules
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {schedule.screen.host.name} · {schedule.screen.name}
          </h1>
          <ScheduleBadge status={schedule.status} />
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {schedule.kind}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          {schedule.placement.creative.name} ·{" "}
          {schedule.placement.advertiser.name || schedule.placement.advertiser.email} ·{" "}
          {formatVertical(schedule.screen.host.vertical, schedule.screen.host.otherLabel)} ·{" "}
          {schedule.screen.host.timezone}
        </p>
        <p className="text-sm text-slate-500">
          {formatScheduleSummary(schedule, schedule.screen.host.timezone)}
        </p>
        <p className="text-xs text-slate-400">
          Created by {schedule.createdBy.name || schedule.createdBy.email}
          {schedule.cancelledAt &&
            ` · Cancelled ${new Date(schedule.cancelledAt).toLocaleString()}`}
        </p>
      </div>

      <ScheduleEditForm
        scheduleId={schedule.id}
        initial={{
          kind: schedule.kind,
          startAt: schedule.startAt ? schedule.startAt.toISOString() : null,
          endAt: schedule.endAt ? schedule.endAt.toISOString() : null,
          weekdays: schedule.weekdays,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          campaignStartDate: schedule.campaignStartDate,
          campaignEndDate: schedule.campaignEndDate,
          status: schedule.status,
          note: schedule.note,
        }}
      />
    </div>
  );
}
