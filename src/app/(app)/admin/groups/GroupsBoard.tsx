"use client";

import { useState } from "react";
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
import type { DeviceGroupListItem } from "@/lib/device-groups";

export function GroupsBoard({ groups }: { groups: DeviceGroupListItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/device-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Create failed");
        return;
      }
      setName("");
      setNote("");
      router.refresh();
      if (data.group?.id) {
        router.push(`/admin/groups/${data.group.id}`);
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup(id: string, groupName: string) {
    if (
      !window.confirm(
        `Delete group “${groupName}”? Members are unfiled; devices are not deleted.`
      )
    ) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/device-groups/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Delete failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          New group
        </h2>
        <form
          onSubmit={(e) => void createGroup(e)}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="min-w-[12rem] flex-1 text-xs text-muted">
            Name
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Downtown strip"
              required
              maxLength={120}
            />
          </label>
          <label className="min-w-[12rem] flex-[2] text-xs text-muted">
            Note (optional)
            <Input
              className="mt-1"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Free-form note"
              maxLength={500}
            />
          </label>
          <Button type="submit" variant="primary" size="sm" disabled={busy}>
            {busy ? "Creating…" : "Create group"}
          </Button>
        </form>
        {error && (
          <p className="mt-3 text-sm text-[var(--status-danger-fg)]">{error}</p>
        )}
      </Card>

      {groups.length === 0 ? (
        <EmptyState>
          No device groups yet. Create one above, then add paired devices from
          the group detail page or Fleet multi-select.
        </EmptyState>
      ) : (
        <CardList>
          {groups.map((g) => (
            <CardListItem key={g.id}>
              <Card glow className="flex h-full flex-col p-4">
                <div className="flex flex-1 flex-col gap-3">
                  <div className="space-y-1">
                    <Link
                      href={`/admin/groups/${g.id}`}
                      className="font-semibold text-accent hover:underline"
                    >
                      {g.name}
                    </Link>
                    <p className="text-sm text-muted">
                      {g.memberCount} device
                      {g.memberCount === 1 ? "" : "s"}
                    </p>
                    {g.note ? (
                      <p className="text-xs text-muted-strong">{g.note}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/groups/${g.id}`}
                      className="text-sm text-accent hover:underline"
                    >
                      Manage members
                    </Link>
                    <Link
                      href={`/admin/fleet?groupId=${g.id}`}
                      className="text-sm text-muted hover:text-accent"
                    >
                      Fleet filter
                    </Link>
                    <button
                      type="button"
                      className="text-sm text-[var(--status-danger-fg)] hover:underline"
                      disabled={deletingId === g.id}
                      onClick={() => void deleteGroup(g.id, g.name)}
                    >
                      {deletingId === g.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </Card>
            </CardListItem>
          ))}
        </CardList>
      )}
    </div>
  );
}
