"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PlacementOpt = {
  id: string;
  label: string;
};

export function ScheduleCreateForm({ placements }: { placements: PlacementOpt[] }) {
  const router = useRouter();
  const [placementId, setPlacementId] = useState(placements[0]?.id || "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overlapWarning, setOverlapWarning] = useState<{
    message: string;
    overlaps: Array<{ id: string; startAt: string; endAt: string }>;
  } | null>(null);

  async function submit(acknowledgeOverlap: boolean) {
    setLoading(true);
    setError("");
    if (!acknowledgeOverlap) setOverlapWarning(null);

    const res = await fetch("/api/admin/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placementId,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        status,
        note: note.trim() || null,
        acknowledgeOverlap,
      }),
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
                {new Date(o.startAt).toLocaleString()} → {new Date(o.endAt).toLocaleString()}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={loading || !placementId}
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
        disabled={loading || !placementId}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Create schedule"}
      </button>
    </form>
  );
}
