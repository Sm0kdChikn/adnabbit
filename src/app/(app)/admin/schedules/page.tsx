import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import { ScheduleBadge } from "@/components/StatusBadge";
import { formatScheduleSummary, materializeEndedSchedules } from "@/lib/schedules";
import { isScheduleStatus } from "@/lib/types";
import { ScheduleFilters } from "./ScheduleFilters";
import { PageHeader } from "@/components/ui";

export default async function AdminSchedulesPage({
  searchParams,
}: {
  searchParams: { screenId?: string; status?: string; from?: string; to?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
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
          include: { host: { select: { name: true, timezone: true } } },
        },
      },
    }),
    prisma.screen.findMany({
      orderBy: { name: "asc" },
      include: { host: { select: { name: true, timezone: true } } },
    }),
  ]);

  const screenOpts = screens.map((s) => ({
    id: s.id,
    name: s.name,
    hostName: s.host.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Create windows for APPROVED placements. ACTIVE schedules past endAt become ENDED on load."
        actions={
          <>
            <Link
              href="/admin/schedules/calendar"
              className="rounded-md bg-surface-hover px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
            >
              Calendar
            </Link>
            <Link
              href="/admin/schedules/new"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent shadow-glow-sm hover:brightness-110"
            >
              New schedule
            </Link>
          </>
        }
      />

      <Suspense fallback={null}>
        <ScheduleFilters screens={screenOpts} />
      </Suspense>

      {schedules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          No schedules match.{" "}
          <Link href="/admin/schedules/new" className="text-accent hover:underline">
            Create one
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-foreground">
                      {s.screen.host.name} · {s.screen.name}
                    </h2>
                    <ScheduleBadge status={s.status} />
                  </div>
                  <p className="text-sm text-muted">
                    {s.placement.creative.name} ·{" "}
                    {s.placement.advertiser.name || s.placement.advertiser.email}
                  </p>
                  <p className="text-sm text-muted">
                    <span className="mr-2 rounded bg-surface-hover px-1.5 py-0.5 text-xs font-medium text-muted">
                      {s.kind}
                    </span>
                    {formatScheduleSummary(s, s.screen.host.timezone)}
                  </p>
                  {s.note && <p className="text-sm text-muted">Note: {s.note}</p>}
                </div>
                <Link
                  href={`/admin/schedules/${s.id}`}
                  className="rounded-md bg-accent-dim px-3 py-1.5 text-sm text-accent hover:bg-accent/15"
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
