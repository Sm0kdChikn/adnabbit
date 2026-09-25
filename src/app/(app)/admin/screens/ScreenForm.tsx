"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { INVENTORY_STATUSES, type InventoryStatus } from "@/lib/types";

type HostOption = { id: string; name: string; vertical: string };

type Props = {
  mode: "create" | "edit";
  screenId?: string;
  hosts: HostOption[];
  initial?: {
    name: string;
    city: string;
    zip: string;
    inventoryStatus: string;
    notes: string | null;
    hostId: string;
  };
};

export function ScreenForm({ mode, screenId, hosts, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name || "");
  const [city, setCity] = useState(initial?.city || "");
  const [zip, setZip] = useState(initial?.zip || "");
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus>(
    (initial?.inventoryStatus as InventoryStatus) || "OPEN"
  );
  const [notes, setNotes] = useState(initial?.notes || "");
  const [hostId, setHostId] = useState(initial?.hostId || hosts[0]?.id || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name,
        city,
        zip,
        inventoryStatus,
        notes: notes || null,
        hostId,
      };
      const url =
        mode === "create" ? "/api/admin/screens" : `/api/admin/screens/${screenId}`;
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
      router.push("/admin/screens");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!screenId || !confirm("Delete this screen?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/screens/${screenId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Delete failed");
        return;
      }
      router.push("/admin/screens");
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
        <label className="mb-1 block text-sm font-medium text-muted">Host</label>
        <select
          required
          value={hostId}
          onChange={(e) => setHostId(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        >
          {hosts.length === 0 && (
            <option value="" disabled>
              No hosts — create one first
            </option>
          )}
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} ({h.vertical})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">
          Vertical is inherited from the host (not stored on the screen).
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-muted">City</label>
          <input
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted">ZIP / postal</label>
          <input
            required
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-muted">
          Inventory status
        </label>
        <select
          required
          value={inventoryStatus}
          onChange={(e) => setInventoryStatus(e.target.value as InventoryStatus)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        >
          {INVENTORY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
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
          disabled={saving || hosts.length === 0}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-brand-bg hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "create" ? "Create screen" : "Save changes"}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            disabled={saving}
            onClick={onDelete}
            className="rounded-md bg-[var(--status-danger-bg)] px-4 py-2 text-sm font-medium text-[var(--status-danger-fg)] hover:bg-rose-100 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
