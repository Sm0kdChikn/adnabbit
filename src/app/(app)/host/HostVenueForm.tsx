"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HOST_VERTICALS, HOST_VERTICAL_LABELS, type HostVertical } from "@/lib/types";

type Props = {
  initial: {
    name: string;
    vertical: string;
    otherLabel: string | null;
    notes: string | null;
    timezone: string;
  };
};

export function HostVenueForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [vertical, setVertical] = useState<HostVertical | "">(
    (initial.vertical as HostVertical) || ""
  );
  const [otherLabel, setOtherLabel] = useState(initial.otherLabel || "");
  const [notes, setNotes] = useState(initial.notes || "");
  const [timezone, setTimezone] = useState(initial.timezone || "America/Denver");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/host", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          vertical,
          otherLabel: vertical === "OTHER" ? otherLabel : null,
          notes: notes || null,
          timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      router.push("/host");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Primary vertical
        </label>
        <select
          required
          value={vertical}
          onChange={(e) => setVertical(e.target.value as HostVertical)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="" disabled>
            Select vertical…
          </option>
          {HOST_VERTICALS.map((v) => (
            <option key={v} value={v}>
              {HOST_VERTICAL_LABELS[v]}
            </option>
          ))}
        </select>
      </div>
      {vertical === "OTHER" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Other label
          </label>
          <input
            required
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            placeholder="Describe the vertical"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Timezone (IANA)
        </label>
        <input
          required
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/Denver"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save venue"}
      </button>
    </form>
  );
}
