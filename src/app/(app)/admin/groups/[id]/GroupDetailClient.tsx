"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardList,
  CardListItem,
  EmptyState,
  Input,
} from "@/components/ui";
import type { DeviceGroupDetail } from "@/lib/device-groups";

type PairedOption = {
  deviceId: string;
  screenId: string;
  screenName: string;
  hostName: string;
  city: string;
};

export function GroupDetailClient({
  group,
  pairedOptions,
}: {
  group: DeviceGroupDetail;
  pairedOptions: PairedOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [note, setNote] = useState(group.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<
    "refresh" | "reboot" | "kioskLock" | "kioskUnlock" | "setOutput"
  >("refresh");

  const memberDeviceIds = useMemo(
    () => new Set(group.members.map((m) => m.deviceId)),
    [group.members]
  );

  const available = useMemo(
    () => pairedOptions.filter((p) => !memberDeviceIds.has(p.deviceId)),
    [pairedOptions, memberDeviceIds]
  );

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/device-groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setMessage("Saved");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function addSelected() {
    if (pick.size === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/device-groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceIds: Array.from(pick) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Add failed");
        return;
      }
      setPick(new Set());
      setMessage(`Added ${data.added ?? 0}`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(deviceId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/device-groups/${group.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceIds: [deviceId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Remove failed");
        return;
      }
      setMessage("Removed");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function runBulk() {
    if (group.memberCount === 0) return;
    if (
      bulkAction === "reboot" &&
      !window.confirm(
        `Reboot all ${group.memberCount} devices in “${group.name}”?`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fleet/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: bulkAction, groupId: group.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Bulk failed");
        return;
      }
      setMessage(
        `Bulk ${bulkAction}: ${data.okCount ?? 0} ok, ${data.failCount ?? 0} failed`
      );
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  function togglePick(deviceId: string) {
    setPick((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <form
          onSubmit={(e) => void saveMeta(e)}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="min-w-[12rem] flex-1 text-xs text-muted">
            Name
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          </label>
          <label className="min-w-[12rem] flex-[2] text-xs text-muted">
            Note
            <Input
              className="mt-1"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </label>
          <Button type="submit" variant="primary" size="sm" disabled={busy}>
            Save
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Bulk on this group
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            value={bulkAction}
            onChange={(e) =>
              setBulkAction(e.target.value as typeof bulkAction)
            }
          >
            <option value="refresh">Refresh playlist</option>
            <option value="kioskLock">Lock kiosk</option>
            <option value="kioskUnlock">Unlock kiosk</option>
            <option value="setOutput">Set output (resolved)</option>
            <option value="reboot">Reboot</option>
          </select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || group.memberCount === 0}
            onClick={() => void runBulk()}
          >
            Run on {group.memberCount} member
            {group.memberCount === 1 ? "" : "s"}
          </Button>
          <Link
            href={`/admin/fleet?groupId=${group.id}`}
            className="text-sm text-accent hover:underline"
          >
            Open in fleet
          </Link>
        </div>
      </Card>

      {error && (
        <p className="text-sm text-[var(--status-danger-fg)]">{error}</p>
      )}
      {message && <p className="text-sm text-emerald-400">{message}</p>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Members ({group.memberCount})
        </h2>
        {group.members.length === 0 ? (
          <EmptyState>No members yet. Add paired devices below.</EmptyState>
        ) : (
          <CardList>
            {group.members.map((m) => (
              <CardListItem key={m.id}>
                <Card glow className="flex h-full flex-col p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <Link
                        href={`/admin/screens/${m.screenId}`}
                        className="font-semibold text-accent hover:underline"
                      >
                        {m.screenName}
                      </Link>
                      <p className="text-sm text-muted">
                        {m.city}, {m.zip} · {m.hostName}
                      </p>
                      <p className="text-xs text-muted-strong">
                        device {m.deviceId.slice(0, 8)}…
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void removeMember(m.deviceId)}
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              </CardListItem>
            ))}
          </CardList>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Add paired devices
          </h2>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy || pick.size === 0}
            onClick={() => void addSelected()}
          >
            Add {pick.size || ""} selected
          </Button>
        </div>
        {available.length === 0 ? (
          <EmptyState>
            {pairedOptions.length === 0
              ? "No paired devices in the fleet yet."
              : "All paired devices are already in this group."}
          </EmptyState>
        ) : (
          <CardList>
            {available.map((p) => {
              const checked = pick.has(p.deviceId);
              return (
                <CardListItem key={p.deviceId}>
                  <Card
                    className={`flex h-full flex-col p-4 ${
                      checked ? "ring-1 ring-accent/50" : ""
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-border accent-[var(--accent)]"
                        checked={checked}
                        onChange={() => togglePick(p.deviceId)}
                      />
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">
                          {p.screenName}
                        </p>
                        <p className="text-sm text-muted">
                          {p.city} · {p.hostName}
                        </p>
                      </div>
                    </label>
                  </Card>
                </CardListItem>
              );
            })}
          </CardList>
        )}
      </section>
    </div>
  );
}
