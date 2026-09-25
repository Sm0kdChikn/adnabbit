"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { INVENTORY_STATUSES, type InventoryStatus } from "@/lib/types";

type Props = {
  mode: "create" | "edit";
  screenId?: string;
  initial?: {
    name: string;
    city: string;
    zip: string;
    inventoryStatus: string;
    notes: string | null;
  };
};

export function HostScreenForm({ mode, screenId, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name || "");
  const [city, setCity] = useState(initial?.city || "");
  const [zip, setZip] = useState(initial?.zip || "");
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus>(
    (initial?.inventoryStatus as InventoryStatus) || "OPEN"
  );
  const [notes, setNotes] = useState(initial?.notes || "");
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
      };
      const url =
        mode === "create" ? "/api/host/screens" : `/api/host/screens/${screenId}`;
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
      router.push("/host");
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
      const res = await fetch(`/api/host/screens/${screenId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Delete failed");
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
          <input
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">ZIP / postal</label>
          <input
            required
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Inventory status
        </label>
        <select
          required
          value={inventoryStatus}
          onChange={(e) => setInventoryStatus(e.target.value as InventoryStatus)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {INVENTORY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
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
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "create" ? "Create screen" : "Save changes"}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            disabled={saving}
            onClick={onDelete}
            className="rounded-md bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
