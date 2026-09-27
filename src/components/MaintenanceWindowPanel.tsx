"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Textarea, FormFeedback, FormPanel } from "@/components/ui";
import { MaintenanceStatusChip } from "@/components/StatusBadge";

export type MaintenanceWindowListItem = {
  id: string;
  scope: "HOST" | "SCREEN";
  targetId: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  active: boolean;
};

type Props = {
  /** API base path e.g. /api/admin/screens/xyz/maintenance */
  apiPath: string;
  title?: string;
  description?: string;
  initialWindows?: MaintenanceWindowListItem[];
  /** Inherited host windows (screen editors only) */
  hostWindows?: MaintenanceWindowListItem[];
  effectiveActive?: boolean;
  effectiveEndsAt?: string | null;
  effectiveScope?: "HOST" | "SCREEN" | null;
  effectiveNote?: string | null;
};

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStart(): string {
  return toLocalInputValue(new Date());
}

function defaultEnd(): string {
  const d = new Date();
  d.setHours(d.getHours() + 2);
  return toLocalInputValue(d);
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function MaintenanceWindowPanel({
  apiPath,
  title = "Maintenance window",
  description = "One-off soft blackout — player goes dark and mutes proof-of-play. Beats force-live. Screen windows override venue windows while overlapping.",
  initialWindows = [],
  hostWindows = [],
  effectiveActive = false,
  effectiveEndsAt = null,
  effectiveScope = null,
  effectiveNote = null,
}: Props) {
  const router = useRouter();
  const [startsLocal, setStartsLocal] = useState(defaultStart);
  const [endsLocal, setEndsLocal] = useState(defaultEnd);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const upcoming = useMemo(
    () =>
      initialWindows.filter(
        (w) => w.active || Date.parse(w.endsAt) > Date.now()
      ),
    [initialWindows]
  );

  async function createWindow() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const startsAt = new Date(startsLocal);
      const endsAt = new Date(endsLocal);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        setError("Invalid start/end time");
        return;
      }
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to create window");
        return;
      }
      setOkMsg("Maintenance window created");
      setNote("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function clearAll() {
    if (
      !confirm(
        "Clear all active and upcoming maintenance windows for this target?"
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(apiPath, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to clear");
        return;
      }
      setOkMsg(
        data.cleared
          ? `Cleared ${data.cleared} window(s)`
          : "Nothing to clear"
      );
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function clearOne(id: string) {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(apiPath, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windowId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to clear");
        return;
      }
      setOkMsg("Window cleared");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormPanel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <MaintenanceStatusChip
          active={effectiveActive}
          endsAt={effectiveEndsAt}
          scope={effectiveScope}
        />
      </div>

      {effectiveActive && effectiveNote ? (
        <p className="text-sm text-muted">Note: {effectiveNote}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted-strong">Starts</span>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            value={startsLocal}
            onChange={(e) => setStartsLocal(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-strong">Ends</span>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            value={endsLocal}
            onChange={(e) => setEndsLocal(e.target.value)}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-muted-strong">Note (optional)</span>
        <Textarea
          className="mt-1"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Projector lamp swap"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={createWindow}>
          {saving ? "Saving…" : "Create window"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving || upcoming.length === 0}
          onClick={clearAll}
        >
          Clear all upcoming
        </Button>
      </div>

      <FormFeedback error={error} ok={okMsg} />

      {upcoming.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {upcoming.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-foreground">
                  {w.active ? (
                    <span className="mr-2 text-[var(--status-info-fg)]">● Active</span>
                  ) : (
                    <span className="mr-2 text-muted">Scheduled</span>
                  )}
                  {formatWhen(w.startsAt)} → {formatWhen(w.endsAt)}
                </p>
                {w.note ? (
                  <p className="text-muted">{w.note}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => clearOne(w.id)}
              >
                Clear
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No active or upcoming windows.</p>
      )}

      {hostWindows.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background/40 p-3 text-sm">
          <p className="font-medium text-foreground">
            Venue (host) windows — inherited when no screen window overlaps
          </p>
          <ul className="mt-2 space-y-1 text-muted">
            {hostWindows.map((w) => (
              <li key={w.id}>
                {w.active ? "● " : ""}
                {formatWhen(w.startsAt)} → {formatWhen(w.endsAt)}
                {w.note ? ` · ${w.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted">
        Soft miss: recurring schedules and bulk create. Auto-reboot into window,
        OptiSigns, and email alerts are out of scope.
      </p>
    </FormPanel>
  );
}