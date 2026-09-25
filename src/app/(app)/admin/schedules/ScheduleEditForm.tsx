"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/schedules";

function toLocalInput(d: string | Date) {
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

const WEEKDAY_OPTS = [1, 2, 3, 4, 5, 6, 7] as const;

export function ScheduleEditForm({
  scheduleId,
  initial,
}: {
  scheduleId: string;
  initial: {
    kind: string;
    startAt: string | null;
    endAt: string | null;
    weekdays: string | null;
    startTime: string | null;
    endTime: string | null;
    campaignStartDate: string | null;
    campaignEndDate: string | null;
    status: string;
    note: string | null;
  };
}) {
  const router = useRouter();
  const locked = initial.status === "CANCELLED" || initial.status === "ENDED";
  const [kind, setKind] = useState<"ONE_OFF" | "RECURRING">(
    initial.kind === "RECURRING" ? "RECURRING" : "ONE_OFF"
  );
  const [startAt, setStartAt] = useState(
    initial.startAt ? toLocalInput(initial.startAt) : ""
  );
  const [endAt, setEndAt] = useState(initial.endAt ? toLocalInput(initial.endAt) : "");
  const [weekdays, setWeekdays] = useState<number[]>(() => {
    if (!initial.weekdays) return [1, 2, 3, 4, 5];
    return initial.weekdays
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => n >= 1 && n <= 7);
  });
  const [startTime, setStartTime] = useState(initial.startTime || "09:00");
  const [endTime, setEndTime] = useState(initial.endTime || "11:00");
  const [campaignStartDate, setCampaignStartDate] = useState(
    initial.campaignStartDate || ""
  );
  const [campaignEndDate, setCampaignEndDate] = useState(initial.campaignEndDate || "");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">(
    initial.status === "ACTIVE" ? "ACTIVE" : "DRAFT"
  );
  const [note, setNote] = useState(initial.note || "");
  const [loading, setLoading] = useState<"save" | "cancel" | null>(null);
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

  async function save(acknowledgeOverlap: boolean) {
    setLoading("save");
    setError("");
    if (!acknowledgeOverlap) setOverlapWarning(null);

    const body: Record<string, unknown> = {
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

    const res = await fetch(`/api/admin/schedules/${scheduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);

    if (res.status === 409 && data.requireAcknowledge) {
      setOverlapWarning({
        message: data.warning || "Overlapping ACTIVE schedule(s)",
        overlaps: data.overlaps || [],
      });
      return;
    }
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    router.refresh();
  }

  async function cancel() {
    if (!confirm("Cancel this schedule?")) return;
    setLoading("cancel");
    setError("");
    const res = await fetch(`/api/admin/schedules/${scheduleId}/cancel`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setError(data.error || "Cancel failed");
      return;
    }
    router.refresh();
  }

  if (locked) {
    return (
      <p className="rounded-md bg-background-elevated px-3 py-2 text-sm text-muted">
        This schedule is {initial.status} and cannot be edited.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Kind</label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "ONE_OFF" | "RECURRING")}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          <option value="ONE_OFF">ONE_OFF</option>
          <option value="RECURRING">RECURRING</option>
        </select>
      </div>

      {kind === "ONE_OFF" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Start</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted">End</label>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Weekdays</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTS.map((d) => (
                <label
                  key={d}
                  className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm ${
                    weekdays.includes(d)
                      ? "border-accent bg-accent-dim text-accent"
                      : "border-border text-muted"
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
              <label className="mb-1 block text-sm font-medium text-muted">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">
                End time (HH:mm, host TZ)
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Same-day requires end &gt; start. Overnight wrap when end &lt; start
            (e.g. 22:00→02:00). Equal times are rejected.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">
                Campaign start
              </label>
              <input
                type="date"
                value={campaignStartDate}
                onChange={(e) => setCampaignStartDate(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted">
                Campaign end
              </label>
              <input
                type="date"
                value={campaignEndDate}
                onChange={(e) => setCampaignEndDate(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "DRAFT" | "ACTIVE")}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          <option value="DRAFT">DRAFT</option>
          <option value="ACTIVE">ACTIVE</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      {overlapWarning && (
        <div className="space-y-2 rounded-md border border-amber-500/30 bg-[var(--status-warning-bg)] p-3 text-sm text-[var(--status-warning-fg)]">
          <p className="font-medium">{overlapWarning.message}</p>
          <ul className="list-inside list-disc text-xs">
            {overlapWarning.overlaps.map((o) => (
              <li key={o.id}>
                {o.kind || "?"} ·{" "}
                {o.kind === "RECURRING"
                  ? `${o.weekdays} ${o.startTime}–${o.endTime}`
                  : `${o.startAt ? new Date(o.startAt).toLocaleString() : "?"} → ${
                      o.endAt ? new Date(o.endAt).toLocaleString() : "?"
                    }`}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={!!loading}
            onClick={() => save(true)}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-on-accent hover:bg-amber-700 disabled:opacity-60"
          >
            Save anyway
          </button>
        </div>
      )}

      {error && <p className="text-sm text-[var(--status-danger-fg)]">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!loading || (kind === "RECURRING" && weekdays.length === 0)}
          onClick={() => save(false)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-60"
        >
          {loading === "save" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={cancel}
          className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {loading === "cancel" ? "Cancelling…" : "Cancel schedule"}
        </button>
      </div>
    </div>
  );
}
