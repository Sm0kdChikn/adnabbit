"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/schedules";

type PlacementOpt = { id: string; label: string };

const WEEKDAY_OPTS = [1, 2, 3, 4, 5, 6, 7] as const;

export function ScheduleCreateForm({ placements }: { placements: PlacementOpt[] }) {
  const router = useRouter();
  const [placementId, setPlacementId] = useState(placements[0]?.id || "");
  const [kind, setKind] = useState<"ONE_OFF" | "RECURRING">("ONE_OFF");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [campaignStartDate, setCampaignStartDate] = useState("");
  const [campaignEndDate, setCampaignEndDate] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overlapWarning, setOverlapWarning] = useState<{
    message: string;
    overlaps: Array<{
      id: string;
      kind?: string;
      startAt?: string | null;
      endAt?: string | null;
      weekdays?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      campaignStartDate?: string | null;
      campaignEndDate?: string | null;
    }>;
  } | null>(null);

  const weekdaysCsv = useMemo(
    () => weekdays.slice().sort((a, b) => a - b).join(","),
    [weekdays]
  );

  function toggleDay(d: number) {
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  }

  async function submit(acknowledgeOverlap: boolean) {
    setLoading(true);
    setError("");
    if (!acknowledgeOverlap) setOverlapWarning(null);

    const body: Record<string, unknown> = {
      placementId,
      kind,
      status,
      note: note.trim() || null,
      acknowledgeOverlap,
    };
    if (kind === "ONE_OFF") {
      body.startAt = new Date(startAt).toISOString();
      body.endAt = new Date(endAt).toISOString();
    } else {
      body.weekdays = weekdaysCsv;
      body.startTime = startTime;
      body.endTime = endTime;
      body.campaignStartDate = campaignStartDate;
      body.campaignEndDate = campaignEndDate;
    }

    const res = await fetch("/api/admin/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (res.status === 409 && data.requireAcknowledge) {
      setOverlapWarning({
        message: data.warning || "Overlapping ACTIVE schedule(s)",
        overlaps: data.overlaps || [],
      });
      return;
    }
    if (!res.ok) {
      setError(data.error || "Create failed");
      return;
    }
    router.push(`/admin/schedules/${data.schedule.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Approved placement
        </label>
        {placements.length === 0 ? (
          <p className="text-sm text-amber-700">
            No APPROVED placements yet. Approve a placement request first.
          </p>
        ) : (
          <select
            required
            value={placementId}
            onChange={(e) => setPlacementId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {placements.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Kind</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "ONE_OFF" | "RECURRING")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ONE_OFF">ONE_OFF (absolute window)</option>
          <option value="RECURRING">RECURRING (weekly daypart)</option>
        </select>
      </div>

      {kind === "ONE_OFF" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Start</label>
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">End</label>
            <input
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Weekdays (ISO Mon=1 … Sun=7)
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTS.map((d) => (
                <label
                  key={d}
                  className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm ${
                    weekdays.includes(d)
                      ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                      : "border-slate-300 text-slate-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={weekdays.includes(d)}
                    onChange={() => toggleDay(d)}
                  />
                  {WEEKDAY_LABELS[d]}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Start time (HH:mm, host TZ)
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                End time (HH:mm, host TZ)
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Same-day requires end &gt; start. Overnight wrap when end &lt; start
            (e.g. 22:00→02:00). Equal times are rejected.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Campaign start
              </label>
              <input
                type="date"
                required
                value={campaignStartDate}
                onChange={(e) => setCampaignStartDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Campaign end
              </label>
              <input
                type="date"
                required
                value={campaignEndDate}
                onChange={(e) => setCampaignEndDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "DRAFT" | "ACTIVE")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="DRAFT">DRAFT</option>
          <option value="ACTIVE">ACTIVE</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {overlapWarning && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{overlapWarning.message}</p>
          <ul className="list-inside list-disc text-xs">
            {overlapWarning.overlaps.map((o) => (
              <li key={o.id}>
                {o.kind || "?"} ·{" "}
                {o.kind === "RECURRING"
                  ? `${o.weekdays} ${o.startTime}–${o.endTime} (${o.campaignStartDate}→${o.campaignEndDate})`
                  : `${o.startAt ? new Date(o.startAt).toLocaleString() : "?"} → ${
                      o.endAt ? new Date(o.endAt).toLocaleString() : "?"
                    }`}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={loading || !placementId || (kind === "RECURRING" && weekdays.length === 0)}
            onClick={() => submit(true)}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700 disabled:opacity-60"
          >
            Create anyway
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !placementId || (kind === "RECURRING" && weekdays.length === 0)}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Create schedule"}
      </button>
    </form>
  );
}
