"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HOST_VERTICALS, HOST_VERTICAL_LABELS, type HostVertical } from "@/lib/types";

type Props = {
  mode: "create" | "edit";
  hostId?: string;
  initial?: {
    name: string;
    vertical: string;
    otherLabel: string | null;
    notes: string | null;
    timezone: string;
  };
};

export function HostForm({ mode, hostId, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name || "");
  const [vertical, setVertical] = useState<HostVertical | "">(
    (initial?.vertical as HostVertical) || ""
  );
  const [otherLabel, setOtherLabel] = useState(initial?.otherLabel || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [timezone, setTimezone] = useState(initial?.timezone || "America/Denver");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name,
        vertical,
        otherLabel: vertical === "OTHER" ? otherLabel : null,
        notes: notes || null,
        timezone,
      };
      const url =
        mode === "create" ? "/api/admin/hosts" : `/api/admin/hosts/${hostId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      router.push("/admin/hosts");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!hostId || !confirm("Delete this host and all its screens?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/hosts/${hostId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Delete failed");
        return;
      }
      router.push("/admin/hosts");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      {error && (
        <p className="rounded-md bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-fg)]">{error}</p>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-muted">
          Primary vertical
        </label>
        <select
          required
          value={vertical}
          onChange={(e) => setVertical(e.target.value as HostVertical)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
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
          <label className="mb-1 block text-sm font-medium text-muted">
            Other label
          </label>
          <input
            required
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            placeholder="Describe the vertical"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-muted">
          Timezone (IANA)
        </label>
        <input
          required
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/Denver"
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        <p className="mt-1 text-xs text-muted">
          Screens inherit this zone for recurring dayparts (default America/Denver).
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-muted">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "create" ? "Create host" : "Save changes"}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            disabled={saving}
            onClick={onDelete}
            className="rounded-md bg-[var(--status-danger-bg)] px-4 py-2 text-sm font-medium text-[var(--status-danger-fg)] hover:brightness-95 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
