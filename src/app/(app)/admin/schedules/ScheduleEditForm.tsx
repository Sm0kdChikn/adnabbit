"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function toLocalInput(d: string | Date) {
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function ScheduleEditForm({
  scheduleId,
  initial,
}: {
  scheduleId: string;
  initial: {
    startAt: string;
    endAt: string;
    status: string;
    note: string | null;
  };
}) {
  const router = useRouter();
  const locked = initial.status === "CANCELLED" || initial.status === "ENDED";
  const [startAt, setStartAt] = useState(toLocalInput(initial.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(initial.endAt));
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">(
    initial.status === "ACTIVE" ? "ACTIVE" : "DRAFT"
  );
  const [note, setNote] = useState(initial.note || "");
  const [loading, setLoading] = useState<"save" | "cancel" | null>(null);
  const [error, setError] = useState("");
  const [overlapWarning, setOverlapWarning] = useState<{
    message: string;
    overlaps: Array<{ id: string; startAt: string; endAt: string }>;
  } | null>(null);

  async function save(acknowledgeOverlap: boolean) {
    setLoading("save");
    setError("");
    if (!acknowledgeOverlap) setOverlapWarning(null);

    const res = await fetch(`/api/admin/schedules/${scheduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        status,
        note: note.trim() || null,
        acknowledgeOverlap,
      }),
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
    const res = await fetch(`/api/admin/schedules/${scheduleId}/cancel`, { method: "POST" });
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
      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        This schedule is {initial.status} and cannot be edited.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Start</label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">End</label>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
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
        <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
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
                {new Date(o.startAt).toLocaleString()} → {new Date(o.endAt).toLocaleString()}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={!!loading}
            onClick={() => save(true)}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700 disabled:opacity-60"
          >
            Save anyway
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!loading}
          onClick={() => save(false)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
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
