"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DeviceStatusBadge } from "@/components/DeviceStatusBadge";
import { Button, Card, CardList, CardListItem } from "@/components/ui";
import type { FleetScreenHealth } from "@/lib/fleet";

type BulkAction = "refresh" | "reboot" | "kioskLock" | "kioskUnlock";

type BulkResult = {
  screenId: string;
  screenName?: string;
  ok: boolean;
  error?: string;
  playlistEpoch?: number;
  queued?: number;
};

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function versionLabel(status: string, version: string | null): string {
  if (status === "missing") return "Version unknown";
  if (status === "lag") return `${version} (behind)`;
  if (status === "unknown") return version || "—";
  return version || "—";
}

export function FleetBoard({ screens }: { screens: FleetScreenHealth[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pairedIds = useMemo(
    () => screens.filter((s) => s.paired).map((s) => s.screenId),
    [screens]
  );
  const onlineSelected = useMemo(
    () =>
      screens.filter((s) => selected.has(s.screenId) && s.online && s.paired),
    [screens, selected]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(pairedIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function requestAction(action: BulkAction) {
    if (selected.size === 0) return;
    setResults(null);
    setError(null);
    if (action === "reboot") {
      setConfirmAction(action);
      return;
    }
    void runBulk(action);
  }

  async function runBulk(action: BulkAction) {
    setConfirmAction(null);
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/admin/fleet/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          screenIds: Array.from(selected),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Bulk action failed");
        return;
      }
      setResults(data.results || []);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="font-medium text-foreground">
            {selected.size} selected
          </span>
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={selectAllVisible}
          >
            Select all paired
          </button>
          <button
            type="button"
            className="text-muted hover:text-accent hover:underline"
            onClick={clearSelection}
          >
            Clear
          </button>
          {onlineSelected.length > 0 && (
            <span className="text-xs text-muted">
              {onlineSelected.length} online in selection
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => requestAction("refresh")}
          >
            Refresh playlist
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => requestAction("kioskLock")}
          >
            Lock kiosk
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => requestAction("kioskUnlock")}
          >
            Unlock kiosk
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => requestAction("reboot")}
            className="!bg-[var(--status-danger-fg)] !text-white hover:!opacity-90"
          >
            Reboot…
          </Button>
        </div>
      </div>

      {confirmAction === "reboot" && (
        <div className="rounded-xl border border-[var(--status-danger-fg)]/40 bg-[var(--status-danger-fg)]/10 p-4">
          <p className="text-sm text-foreground">
            Reboot <strong>{selected.size}</strong> selected device
            {selected.size === 1 ? "" : "s"}? Each online player will quit
            cleanly then reboot the mini-PC OS. Offline / unpaired devices are
            skipped with an error — not all-or-nothing.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void runBulk("reboot")}
              className="!bg-[var(--status-danger-fg)] !text-white"
            >
              {busy ? "Queuing…" : "Confirm reboot"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-[var(--status-danger-fg)]/40 bg-[var(--status-danger-fg)]/10 px-3 py-2 text-sm text-[var(--status-danger-fg)]">
          {error}
        </p>
      )}

      {results && (
        <div className="rounded-xl border border-border bg-surface p-3 text-sm">
          <p className="mb-2 font-medium text-foreground">
            Bulk results — {results.filter((r) => r.ok).length} ok,{" "}
            {results.filter((r) => !r.ok).length} failed
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {results.map((r) => (
              <li
                key={r.screenId}
                className={
                  r.ok ? "text-emerald-400" : "text-[var(--status-danger-fg)]"
                }
              >
                {r.screenName || r.screenId}:{" "}
                {r.ok
                  ? r.playlistEpoch != null
                    ? `epoch → ${r.playlistEpoch}`
                    : `queued ${r.queued ?? 1}`
                  : r.error || "failed"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CardList>
        {screens.map((s) => {
          const checked = selected.has(s.screenId);
          return (
            <CardListItem key={s.screenId}>
              <Card
                glow
                className={`flex h-full flex-col p-4 ${
                  !s.online || s.emptyPlaylist
                    ? "ring-1 ring-[var(--status-danger-fg)]/30"
                    : ""
                } ${checked ? "ring-1 ring-accent/50" : ""}`}
              >
                <div className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex min-w-0 cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-border accent-[var(--accent)]"
                        checked={checked}
                        disabled={!s.paired}
                        title={
                          s.paired
                            ? "Select for bulk ops"
                            : "Unpaired — cannot select"
                        }
                        onChange={() => toggle(s.screenId)}
                      />
                      <div className="min-w-0 space-y-1">
                        <Link
                          href={`/admin/screens/${s.screenId}`}
                          className="font-semibold text-accent hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.screenName}
                        </Link>
                        <p className="text-sm text-muted">
                          {s.city}, {s.zip} ·{" "}
                          <Link
                            href={`/admin/hosts/${s.hostId}`}
                            className="hover:text-accent"
                          >
                            {s.hostName}
                          </Link>
                        </p>
                      </div>
                    </label>
                    <DeviceStatusBadge status={s.displayStatus} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-strong">Last seen</dt>
                      <dd className="text-foreground">
                        {formatLastSeen(s.lastSeenAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-strong">Hours</dt>
                      <dd className="text-foreground">
                        {s.playbackAllowed
                          ? s.forceLiveActive
                            ? "Open (force live)"
                            : "Open"
                          : "Closed hours"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-strong">Active items</dt>
                      <dd className="text-foreground">
                        {s.activeItemCount}
                        {s.emptyPlaylist ? (
                          <span className="ml-1 text-amber-300">· empty</span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-strong">Player</dt>
                      <dd className="text-foreground">
                        {versionLabel(s.versionStatus, s.playerVersion)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-strong">Disk</dt>
                      <dd className="text-foreground">
                        {s.diskCritical === true
                          ? "Critical"
                          : s.diskFreeBytes != null
                            ? `${Math.round(s.diskFreeBytes / (1024 * 1024))} MB free`
                            : "— (TODO)"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-strong">Playback</dt>
                      <dd className="text-foreground">
                        {s.playbackState || "—"}
                      </dd>
                    </div>
                  </dl>

                  {s.openAlertKinds.length > 0 ? (
                    <p className="text-xs text-[var(--status-danger-fg)]">
                      Open alert: {s.openAlertKinds.join(", ")}
                    </p>
                  ) : null}
                </div>
              </Card>
            </CardListItem>
          );
        })}
      </CardList>
    </div>
  );
}
