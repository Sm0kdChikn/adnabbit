"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeviceStatusBadge } from "@/components/DeviceStatusBadge";
import {
  HoursStatusChip,
  OfflinePolicyChip,
  StatusChip,
} from "@/components/StatusBadge";
import { Button, Card, CardList, CardListItem } from "@/components/ui";
import type { FleetScreenHealth } from "@/lib/fleet";
import type { DeviceGroupListItem } from "@/lib/device-groups";

type BulkAction =
  | "refresh"
  | "reboot"
  | "kioskLock"
  | "kioskUnlock"
  | "setOutput";

type BulkResult = {
  screenId: string;
  screenName?: string;
  ok: boolean;
  error?: string;
  playlistEpoch?: number;
  queued?: number;
  volume?: number;
  brightness?: number;
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

export function FleetBoard({
  screens,
  groups,
  activeGroupId,
}: {
  screens: FleetScreenHealth[];
  groups: DeviceGroupListItem[];
  activeGroupId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupTargetId, setGroupTargetId] = useState(
    activeGroupId || groups[0]?.id || ""
  );
  const [outputVolume, setOutputVolume] = useState("");
  const [outputBrightness, setOutputBrightness] = useState("");
  const [showOutput, setShowOutput] = useState(false);

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
    if (action === "setOutput") {
      setShowOutput(true);
      return;
    }
    void runBulk(action);
  }

  async function runBulk(action: BulkAction) {
    setConfirmAction(null);
    setShowOutput(false);
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const payload: Record<string, unknown> = {
        action,
        screenIds: Array.from(selected),
      };
      if (action === "setOutput") {
        if (outputVolume.trim() !== "") {
          payload.volume = parseInt(outputVolume.trim(), 10);
        }
        if (outputBrightness.trim() !== "") {
          payload.brightness = parseInt(outputBrightness.trim(), 10);
        }
      }
      const res = await fetch("/api/admin/fleet/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  async function runGroupMembers(op: "add" | "remove") {
    if (!groupTargetId || selected.size === 0) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(
        `/api/admin/device-groups/${groupTargetId}/members`,
        {
          method: op === "add" ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ screenIds: Array.from(selected) }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Group ${op} failed`);
        return;
      }
      if (op === "add" && Array.isArray(data.screenResults)) {
        setResults(
          data.screenResults.map(
            (r: {
              screenId: string;
              ok: boolean;
              error?: string;
            }) => ({
              screenId: r.screenId,
              ok: r.ok,
              error: r.error,
            })
          )
        );
      } else {
        setResults([
          {
            screenId: groupTargetId,
            screenName: "Group",
            ok: true,
            queued: op === "add" ? data.added : data.removed,
          },
        ]);
      }
      router.refresh();
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
            variant="secondary"
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => requestAction("setOutput")}
          >
            Set output…
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

      {groups.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="whitespace-nowrap">Group</span>
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              value={groupTargetId}
              onChange={(e) => setGroupTargetId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount})
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || selected.size === 0 || !groupTargetId}
            onClick={() => void runGroupMembers("add")}
          >
            Add to group
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || selected.size === 0 || !groupTargetId}
            onClick={() => void runGroupMembers("remove")}
          >
            Remove from group
          </Button>
        </div>
      )}

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

      {showOutput && (
        <div className="rounded-xl border border-accent/30 bg-accent-dim/40 p-4">
          <p className="text-sm text-foreground">
            Queue <strong>setOutput</strong> on {selected.size} device
            {selected.size === 1 ? "" : "s"}. Leave blank to use each screen&apos;s
            resolved prefs (screen → host → 80/100).
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted">
              Volume 0–100
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 block w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                value={outputVolume}
                onChange={(e) => setOutputVolume(e.target.value)}
                placeholder="resolve"
              />
            </label>
            <label className="text-xs text-muted">
              Brightness 0–100
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 block w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                value={outputBrightness}
                onChange={(e) => setOutputBrightness(e.target.value)}
                placeholder="resolve"
              />
            </label>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void runBulk("setOutput")}
            >
              {busy ? "Queuing…" : "Confirm setOutput"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setShowOutput(false)}
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
            Results — {results.filter((r) => r.ok).length} ok,{" "}
            {results.filter((r) => !r.ok).length} failed
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {results.map((r, i) => (
              <li
                key={`${r.screenId}-${i}`}
                className={
                  r.ok ? "text-[var(--status-success-fg)]" : "text-[var(--status-danger-fg)]"
                }
              >
                {r.screenName || r.screenId || "—"}:{" "}
                {r.ok
                  ? r.playlistEpoch != null
                    ? `epoch → ${r.playlistEpoch}`
                    : r.volume != null || r.brightness != null
                      ? `setOutput v${r.volume} b${r.brightness}`
                      : `ok${r.queued != null ? ` (${r.queued})` : ""}`
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
                className={`flex h-full flex-col p-3 ${
                  !s.online || s.emptyPlaylist
                    ? "ring-1 ring-[var(--status-danger-fg)]/30"
                    : ""
                } ${checked ? "ring-1 ring-accent/50" : ""}`}
              >
                <div className="flex flex-1 flex-col gap-2">
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
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <DeviceStatusBadge status={s.displayStatus} />
                    {s.maintenanceActive ? (
                      <StatusChip
                        tone="info"
                        title={
                          s.maintenanceEndsAt
                            ? `Ends ${new Date(s.maintenanceEndsAt).toLocaleString()}`
                            : "Maintenance soft blackout"
                        }
                      >
                        MAINTENANCE
                      </StatusChip>
                    ) : (
                      <HoursStatusChip
                        open={s.playbackAllowed}
                        openLabel="OPEN"
                        closedLabel="CLOSED"
                        forceLive={s.forceLiveActive}
                      />
                    )}
                    <OfflinePolicyChip
                      online={s.online}
                      policy={s.offlinePolicy}
                      ttlHours={s.offlineCacheTtlHours}
                      mayPlayCache={s.mayPlayCache}
                    />
                    <StatusChip
                      tone={
                        s.versionStatus === "lag"
                          ? "warning"
                          : s.versionStatus === "missing"
                            ? "neutral"
                            : "neutral"
                      }
                      title="Player version"
                    >
                      {versionLabel(s.versionStatus, s.playerVersion)}
                    </StatusChip>
                    {s.playbackState ? (
                      <StatusChip tone="neutral" title="Playback / output state">
                        {s.playbackState}
                      </StatusChip>
                    ) : null}
                    {s.emptyPlaylist ? (
                      <StatusChip tone="warning">Empty playlist</StatusChip>
                    ) : (
                      <StatusChip tone="neutral">
                        {s.activeItemCount} item
                        {s.activeItemCount === 1 ? "" : "s"}
                      </StatusChip>
                    )}
                    {s.diskCritical === true ? (
                      <StatusChip tone="danger">Disk critical</StatusChip>
                    ) : null}
                    {s.openAlertKinds.length > 0 ? (
                      <StatusChip tone="danger">
                        Alert: {s.openAlertKinds.join(", ")}
                      </StatusChip>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted">
                    Last seen {formatLastSeen(s.lastSeenAt)}
                    {s.diskFreeBytes != null
                      ? ` · ${Math.round(s.diskFreeBytes / (1024 * 1024))} MB free`
                      : ""}
                    {s.maintenanceActive && s.maintenanceEndsAt
                      ? ` · maint ends ${new Date(s.maintenanceEndsAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
              </Card>
            </CardListItem>
          );
        })}
      </CardList>
    </div>
  );
}
