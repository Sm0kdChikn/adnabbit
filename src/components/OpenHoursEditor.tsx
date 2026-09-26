"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { WEEKDAY_LABELS } from "@/lib/schedules";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;

export type WeeklyHourRow = {
  weekday: number;
  openTime: string | null;
  closeTime: string | null;
};

type Props = {
  /** IANA timezone label shown in the header */
  timezone: string;
  initialWeekly: WeeklyHourRow[];
  /** When true, show inherit/custom toggle (screen-level editor). */
  showCustomToggle?: boolean;
  useCustomHours?: boolean;
  /** Admin-only force-live controls */
  showForceLive?: boolean;
  forceLiveUntil?: string | null;
  /** Current effective summary from server */
  summary?: string | null;
  /** isOpenNow hint */
  isOpenNow?: boolean | null;
  savePath: string;
  /** Extra JSON fields merged into PUT body */
  onSaved?: () => void;
};

function normalizeInitial(rows: WeeklyHourRow[]): WeeklyHourRow[] {
  const by = new Map(rows.map((r) => [r.weekday, r]));
  return DAY_ORDER.map((weekday) => {
    const r = by.get(weekday);
    return {
      weekday,
      openTime: r?.openTime ?? null,
      closeTime: r?.closeTime ?? null,
    };
  });
}

export function OpenHoursEditor({
  timezone,
  initialWeekly,
  showCustomToggle = false,
  useCustomHours: initialCustom = false,
  showForceLive = false,
  forceLiveUntil: initialForce = null,
  summary,
  isOpenNow,
  savePath,
  onSaved,
}: Props) {
  const [weekly, setWeekly] = useState(() => normalizeInitial(initialWeekly));
  const [useCustom, setUseCustom] = useState(initialCustom);
  const [forceLocal, setForceLocal] = useState(() => {
    if (!initialForce) return "";
    try {
      const d = new Date(initialForce);
      // datetime-local wants local wall without Z
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const editable = !showCustomToggle || useCustom;

  const preview = useMemo(() => {
    const open = weekly.filter((r) => r.openTime && r.closeTime);
    if (open.length === 0) return "Closed all week";
    return open
      .map(
        (r) =>
          `${WEEKDAY_LABELS[r.weekday]} ${r.openTime}–${r.closeTime}`
      )
      .join(" · ");
  }, [weekly]);

  function setDay(
    weekday: number,
    patch: Partial<Pick<WeeklyHourRow, "openTime" | "closeTime">>
  ) {
    setWeekly((prev) =>
      prev.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r))
    );
  }

  function toggleClosed(weekday: number, closed: boolean) {
    if (closed) {
      setDay(weekday, { openTime: null, closeTime: null });
    } else {
      setDay(weekday, { openTime: "09:00", closeTime: "17:00" });
    }
  }

  function applyPreset(kind: "business" | "everyday" | "clear") {
    if (kind === "clear") {
      setWeekly(
        DAY_ORDER.map((weekday) => ({
          weekday,
          openTime: null,
          closeTime: null,
        }))
      );
      return;
    }
    if (kind === "everyday") {
      setWeekly(
        DAY_ORDER.map((weekday) => ({
          weekday,
          openTime: "09:00",
          closeTime: "17:00",
        }))
      );
      return;
    }
    setWeekly(
      DAY_ORDER.map((weekday) =>
        weekday <= 5
          ? { weekday, openTime: "09:00", closeTime: "17:00" }
          : { weekday, openTime: null, closeTime: null }
      )
    );
  }

  function copyMonday() {
    const mon = weekly.find((r) => r.weekday === 1);
    if (!mon) return;
    setWeekly((prev) =>
      prev.map((r) =>
        r.weekday >= 2 && r.weekday <= 5
          ? { ...r, openTime: mon.openTime, closeTime: mon.closeTime }
          : r
      )
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const body: Record<string, unknown> = {};
      if (showCustomToggle) {
        body.useCustomHours = useCustom;
        if (useCustom) body.weekly = weekly;
        if (!useCustom) {
          // inherit venue — no weekly write required
        }
      } else {
        body.weekly = weekly;
      }
      if (showForceLive) {
        if (!forceLocal.trim()) {
          body.forceLiveUntil = null;
        } else {
          const d = new Date(forceLocal);
          if (Number.isNaN(d.getTime())) {
            setError("Invalid force-live timestamp");
            setSaving(false);
            return;
          }
          body.forceLiveUntil = d.toISOString();
        }
      }

      const res = await fetch(savePath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setOkMsg(data.summary || data.effective?.reason || "Saved");
      if (data.effective?.weekly) {
        setWeekly(normalizeInitial(data.effective.weekly));
      } else if (data.weekly) {
        setWeekly(normalizeInitial(data.weekly));
      }
      if (typeof data.useCustomHours === "boolean") {
        setUseCustom(data.useCustomHours);
      }
      onSaved?.();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function clearToAlwaysOpen() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const body = showCustomToggle
        ? { clearCustom: true }
        : { clear: true };
      const res = await fetch(savePath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Clear failed");
        return;
      }
      setWeekly(
        DAY_ORDER.map((weekday) => ({
          weekday,
          openTime: null,
          closeTime: null,
        }))
      );
      if (showCustomToggle) setUseCustom(false);
      setOkMsg("Always open (hours cleared)");
      onSaved?.();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Open hours</h2>
          <p className="text-sm text-muted">
            Soft blackout outside these hours — player goes dark and skips
            proof-of-play. Timezone:{" "}
            <span className="font-medium text-accent">{timezone}</span>
          </p>
        </div>
        {typeof isOpenNow === "boolean" && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              isOpenNow
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-slate-500/20 text-slate-300"
            }`}
          >
            {isOpenNow ? "Open now" : "Closed now"}
          </span>
        )}
      </div>

      {summary && (
        <p className="text-sm text-muted-strong">
          Effective: <span className="text-foreground">{summary}</span>
        </p>
      )}

      {showCustomToggle && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="rounded border-border accent-[var(--accent)]"
            checked={useCustom}
            onChange={(e) => setUseCustom(e.target.checked)}
          />
          Override venue hours for this screen
        </label>
      )}

      {showCustomToggle && !useCustom && (
        <p className="rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm text-muted">
          Inheriting venue weekly hours. Enable override to set a screen-specific
          schedule.
        </p>
      )}

      {editable && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => applyPreset("business")}
            >
              Mon–Fri 9–5
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => applyPreset("everyday")}
            >
              Every day 9–5
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={copyMonday}
            >
              Copy Mon → Fri
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => applyPreset("clear")}
            >
              Close all
            </Button>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {weekly.map((row) => {
              const closed = !row.openTime || !row.closeTime;
              return (
                <li
                  key={row.weekday}
                  className="flex flex-col gap-2 bg-background-elevated px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-[5.5rem] items-center gap-2">
                    <span className="w-10 text-sm font-semibold text-foreground">
                      {WEEKDAY_LABELS[row.weekday]}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={closed}
                        onChange={(e) =>
                          toggleClosed(row.weekday, e.target.checked)
                        }
                      />
                      Closed
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      disabled={closed}
                      value={row.openTime || "09:00"}
                      onChange={(e) =>
                        setDay(row.weekday, { openTime: e.target.value })
                      }
                      className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground disabled:opacity-40"
                    />
                    <span className="text-muted">→</span>
                    <input
                      type="time"
                      disabled={closed}
                      value={row.closeTime || "17:00"}
                      onChange={(e) =>
                        setDay(row.weekday, { closeTime: e.target.value })
                      }
                      className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground disabled:opacity-40"
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-muted">Preview: {preview}</p>
        </>
      )}

      {showForceLive && (
        <div className="space-y-2 rounded-lg border border-accent/30 bg-accent-dim/40 px-3 py-3">
          <label className="block text-sm font-medium text-foreground">
            Force live until (admin)
          </label>
          <p className="text-xs text-muted">
            Bypass closed hours until this local time. Clear to disable.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={forceLocal}
              onChange={(e) => setForceLocal(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setForceLocal("")}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-[var(--status-danger-fg)]">{error}</p>
      )}
      {okMsg && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{okMsg}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save hours"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void clearToAlwaysOpen()}
          disabled={saving}
          title="Remove schedule → always open"
        >
          Always open
        </Button>
      </div>

      <p className="text-xs text-muted">
        Hard display-off (CEC / DPMS) is stubbed — soft blackout only for now.
      </p>
    </section>
  );
}
