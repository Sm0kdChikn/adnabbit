"use client";

import { useRouter } from "next/navigation";
import {
  formControlClass,
  formHintClass,
  formLabelClass,
} from "@/components/ui";
import { useState } from "react";
import { HOST_VERTICALS, HOST_VERTICAL_LABELS, type HostVertical } from "@/lib/types";

type Props = {
  initial: {
    name: string;
    vertical: string;
    otherLabel: string | null;
    notes: string | null;
    timezone: string;
    offlinePolicy?: string;
    offlineCacheTtlHours?: number;
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
  const [offlinePolicy, setOfflinePolicy] = useState(
    initial.offlinePolicy === "BLACKOUT" ? "BLACKOUT" : "PLAY_CACHE"
  );
  const [offlineCacheTtlHours, setOfflineCacheTtlHours] = useState(
    String(initial.offlineCacheTtlHours ?? 24)
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ttl = parseInt(offlineCacheTtlHours, 10);
    if (!Number.isFinite(ttl) || ttl < 0 || ttl > 8760) {
      setError("Cache TTL must be an integer 0–8760 hours");
      return;
    }
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
          offlinePolicy,
          offlineCacheTtlHours: ttl,
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
      className="max-w-lg space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
    >
      {error && (
        <p className="rounded-md bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-fg)]">{error}</p>
      )}
      <div>
        <label className={formLabelClass}>Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={formControlClass}
        />
      </div>
      <div>
        <label className={formLabelClass}>
          Primary vertical
        </label>
        <select
          required
          value={vertical}
          onChange={(e) => setVertical(e.target.value as HostVertical)}
          className={formControlClass}
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
          <label className={formLabelClass}>
            Other label
          </label>
          <input
            required
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            placeholder="Describe the vertical"
            className={formControlClass}
          />
        </div>
      )}
      <div>
        <label className={formLabelClass}>
          Timezone (IANA)
        </label>
        <input
          required
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/Denver"
          className={formControlClass}
        />
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Offline play policy</h3>
          <p className="mt-1 text-xs text-muted">
            When the player cannot reach AdNabbit: keep looping the last playlist, or go dark.
          </p>
        </div>
        <div>
          <label className={formLabelClass}>Policy</label>
          <select
            value={offlinePolicy}
            onChange={(e) => setOfflinePolicy(e.target.value)}
            className={formControlClass}
          >
            <option value="PLAY_CACHE">Play cache (loop last playlist)</option>
            <option value="BLACKOUT">Blackout immediately when offline</option>
          </select>
        </div>
        <div>
          <label className={formLabelClass}>
            Offline cache TTL (hours)
          </label>
          <input
            type="number"
            min={0}
            max={8760}
            required
            value={offlineCacheTtlHours}
            onChange={(e) => setOfflineCacheTtlHours(e.target.value)}
            className={formControlClass}
          />
          <p className={formHintClass}>
            Default 24. Set 0 to blackout as soon as the player goes offline.
          </p>
        </div>
      </div>
      <div>
        <label className={formLabelClass}>
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={formControlClass}
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save venue"}
      </button>
    </form>
  );
}
