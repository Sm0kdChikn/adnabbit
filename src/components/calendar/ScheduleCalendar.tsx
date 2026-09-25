"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addYmd,
  expandSchedulesToBlocks,
  formatMinutesLabel,
  isoWeekdayFromYmd,
  monthGridRange,
  startOfMonthYmd,
  todayYmd,
  weekRange,
  type CalendarBlock,
  type CalendarScheduleInput,
} from "@/lib/calendar-expand";
import { DEFAULT_TIMEZONE, WEEKDAY_LABELS } from "@/lib/schedules";

const HOUR_START = 6;
const HOUR_END = 22;
const PX_PER_HOUR = 48;

type Props = {
  schedules: CalendarScheduleInput[];
  basePath: string;
  detailBasePath?: string;
  defaultTimeZone?: string;
};

function statusClass(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-600 bg-emerald-100 text-emerald-900";
    case "DRAFT":
      return "border-slate-400 bg-slate-100 text-slate-800";
    case "ENDED":
      return "border-slate-300 bg-slate-50 text-slate-500";
    case "CANCELLED":
      return "border-rose-300 bg-rose-50 text-rose-700";
    default:
      return "border-indigo-300 bg-indigo-50 text-indigo-900";
  }
}

function BlockChip({ block, href }: { block: CalendarBlock; href?: string }) {
  const label = `${formatMinutesLabel(block.startMinutes)}–${formatMinutesLabel(block.endMinutes)} · ${block.title}`;
  const className = `mb-0.5 block truncate rounded border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-snug shadow-sm hover:brightness-95 ${statusClass(block.status)}`;
  if (href) {
    return (
      <Link href={href} className={className} title={`${label} (${block.kind} · ${block.status})`}>
        <span className="font-semibold">{formatMinutesLabel(block.startMinutes)}</span> {block.title}
      </Link>
    );
  }
  return (
    <div className={className} title={`${label} (${block.kind} · ${block.status})`}>
      <span className="font-semibold">{formatMinutesLabel(block.startMinutes)}</span> {block.title}
    </div>
  );
}

export function ScheduleCalendar({
  schedules,
  basePath,
  detailBasePath,
  defaultTimeZone = DEFAULT_TIMEZONE,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const view = sp.get("view") === "month" ? "month" : "week";
  const includeEnded =
    sp.get("includeEnded") === "1" || sp.get("includeEnded") === "true";
  const statusFilter = sp.get("status")?.trim() || "";
  const screenIdFilter = sp.get("screenId")?.trim() || "";
  const anchor = sp.get("date")?.trim() || todayYmd(defaultTimeZone);

  const screenOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const s of schedules) {
      if (map.has(s.screenId)) continue;
      map.set(s.screenId, {
        id: s.screenId,
        label: `${s.screen.host.name} · ${s.screen.name}`,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [schedules]);

  const filtered = useMemo(() => {
    return schedules.filter((s) => {
      if (screenIdFilter && s.screenId !== screenIdFilter) return false;
      if (statusFilter) return s.status === statusFilter;
      if (includeEnded) return true;
      return s.status === "ACTIVE" || s.status === "DRAFT";
    });
  }, [schedules, includeEnded, statusFilter, screenIdFilter]);

  const range = useMemo(
    () => (view === "month" ? monthGridRange(anchor) : weekRange(anchor)),
    [view, anchor]
  );

  const blocks = useMemo(
    () => expandSchedulesToBlocks(filtered, range.start, range.end),
    [filtered, range.start, range.end]
  );

  const blocksByDay = useMemo(() => {
    const map = new Map<string, CalendarBlock[]>();
    for (const b of blocks) {
      const list = map.get(b.dayYmd) || [];
      list.push(b);
      map.set(b.dayYmd, list);
    }
    return map;
  }, [blocks]);

  function pushParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const q = params.toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  function hrefFor(id: string): string | undefined {
    return detailBasePath ? `${detailBasePath}/${id}` : undefined;
  }

  const label = view === "week" ? `${range.start} → ${range.end}` : anchor.slice(0, 7);
  const gridStartMin = HOUR_START * 60;
  const gridEndMin = HOUR_END * 60;
  const gridHeight = (HOUR_END - HOUR_START) * PX_PER_HOUR;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex rounded-md border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => pushParams({ view: "week" })}
            className={`rounded px-3 py-1.5 text-sm font-medium ${view === "week" ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => pushParams({ view: "month" })}
            className={`rounded px-3 py-1.5 text-sm font-medium ${view === "month" ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}
          >
            Month
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50"
            onClick={() =>
              pushParams({
                date:
                  view === "week"
                    ? addYmd(range.start, -7)
                    : addYmd(startOfMonthYmd(anchor), -1),
              })
            }
          >
            ←
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => pushParams({ date: todayYmd(defaultTimeZone) })}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => {
              if (view === "week") pushParams({ date: addYmd(range.start, 7) });
              else {
                const [y, m] = startOfMonthYmd(anchor).split("-").map(Number);
                const nextM = m === 12 ? 1 : m + 1;
                const nextY = m === 12 ? y + 1 : y;
                pushParams({
                  date: `${nextY}-${String(nextM).padStart(2, "0")}-01`,
                });
              }
            }}
          >
            →
          </button>
        </div>

        <span className="text-sm font-medium text-slate-800">{label}</span>

        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeEnded}
            onChange={(e) =>
              pushParams({
                includeEnded: e.target.checked ? "1" : null,
                status: null,
              })
            }
          />
          Show CANCELLED / ENDED
        </label>

        <select
          value={statusFilter}
          onChange={(e) =>
            pushParams({
              status: e.target.value || null,
              includeEnded: e.target.value ? "1" : includeEnded ? "1" : null,
            })
          }
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">ACTIVE + DRAFT</option>
          <option value="ACTIVE">ACTIVE only</option>
          <option value="DRAFT">DRAFT only</option>
          <option value="ENDED">ENDED only</option>
          <option value="CANCELLED">CANCELLED only</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="whitespace-nowrap">Screen</span>
          <select
            value={screenIdFilter}
            onChange={(e) =>
              pushParams({ screenId: e.target.value || null })
            }
            className="max-w-[220px] rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All screens</option>
            {screenOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-slate-500">
        Blocks expanded in each screen&apos;s host timezone (date-fns-tz). {blocks.length}{" "}
        block{blocks.length === 1 ? "" : "s"} in view · {filtered.length} schedule
        {filtered.length === 1 ? "" : "s"} shown.
      </p>

      {view === "week" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div
            className="grid min-w-[720px]"
            style={{ gridTemplateColumns: "48px repeat(7, minmax(0, 1fr))" }}
          >
            <div className="border-b border-slate-200 bg-slate-50 p-2" />
            {range.days.map((day) => {
              const iso = isoWeekdayFromYmd(day);
              return (
                <div
                  key={day}
                  className="border-b border-l border-slate-200 bg-slate-50 p-2 text-center"
                >
                  <div className="text-xs font-medium text-slate-500">
                    {WEEKDAY_LABELS[iso]}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{day.slice(8)}</div>
                </div>
              );
            })}

            <div className="relative" style={{ height: gridHeight }}>
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
                const hour = HOUR_START + i;
                return (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-slate-100 pr-1 text-right text-[10px] text-slate-400"
                    style={{ top: i * PX_PER_HOUR }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                );
              })}
            </div>

            {range.days.map((day) => {
              const dayBlocks = blocksByDay.get(day) || [];
              return (
                <div
                  key={day}
                  className="relative border-l border-slate-100 bg-white"
                  style={{ height: gridHeight }}
                >
                  {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-slate-50"
                      style={{ top: i * PX_PER_HOUR, height: PX_PER_HOUR }}
                    />
                  ))}
                  {dayBlocks.map((b) => {
                    const topMin = Math.max(b.startMinutes, gridStartMin);
                    const botMin = Math.min(b.endMinutes, gridEndMin);
                    if (botMin <= gridStartMin || topMin >= gridEndMin) {
                      return (
                        <div key={b.key} className="relative z-10 px-0.5 pt-0.5">
                          <BlockChip block={b} href={hrefFor(b.scheduleId)} />
                        </div>
                      );
                    }
                    const top = ((topMin - gridStartMin) / 60) * PX_PER_HOUR;
                    const height = Math.max(
                      18,
                      ((botMin - topMin) / 60) * PX_PER_HOUR - 2
                    );
                    const href = hrefFor(b.scheduleId);
                    const inner = (
                      <>
                        <div className="truncate font-semibold">
                          {formatMinutesLabel(b.startMinutes)}–
                          {formatMinutesLabel(b.endMinutes)}
                        </div>
                        <div className="truncate">{b.title}</div>
                        <div className="truncate opacity-80">{b.kind}</div>
                      </>
                    );
                    const cls = `absolute left-0.5 right-0.5 z-10 overflow-hidden rounded border-l-4 px-1 py-0.5 text-[10px] leading-tight shadow-sm ${statusClass(b.status)}`;
                    if (href) {
                      return (
                        <Link
                          key={b.key}
                          href={href}
                          className={`${cls} hover:brightness-95`}
                          style={{ top, height }}
                          title={`${b.title} · ${b.subtitle} · ${b.status}`}
                        >
                          {inner}
                        </Link>
                      );
                    }
                    return (
                      <div
                        key={b.key}
                        className={cls}
                        style={{ top, height }}
                        title={`${b.title} · ${b.subtitle} · ${b.status}`}
                      >
                        {inner}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className="p-2">
                {WEEKDAY_LABELS[d]}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {range.days.map((day) => {
              const inMonth = day.slice(0, 7) === anchor.slice(0, 7);
              const dayBlocks = blocksByDay.get(day) || [];
              return (
                <div
                  key={day}
                  className={`min-h-[96px] border-b border-r border-slate-100 p-1 ${inMonth ? "bg-white" : "bg-slate-50/60"}`}
                >
                  <div
                    className={`mb-1 text-right text-xs font-medium ${inMonth ? "text-slate-700" : "text-slate-400"}`}
                  >
                    {day.slice(8)}
                  </div>
                  <div className="space-y-0.5">
                    {dayBlocks.slice(0, 4).map((b) => (
                      <BlockChip key={b.key} block={b} href={hrefFor(b.scheduleId)} />
                    ))}
                    {dayBlocks.length > 4 && (
                      <div className="text-[10px] text-slate-500">
                        +{dayBlocks.length - 4} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
