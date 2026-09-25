"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImportForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    insertedCount: number;
    skippedDupes: number;
    rowCount: number;
    filename: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/admin/pop/import", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Import failed (${res.status})`);
        return;
      }
      setResult({
        insertedCount: data.import.insertedCount,
        skippedDupes: data.import.skippedDupes,
        rowCount: data.import.rowCount,
        filename: data.import.filename,
      });
      form.reset();
      router.refresh();
    } catch {
      setError("Network error during import");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold text-foreground">Import OptiSigns PoP CSV</h2>
        <p className="text-xs text-muted">
          Required headers: Report Date UTC, Account ID, Screen UUID, Screen Name, Screen Tags,
          Asset ID, Asset Name, Asset Tags, Start Time UTC, Device Local Time, Duration (seconds).
          Dupes skipped by rawHash. Host filler rows are flagged automatically.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">CSV file</label>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block w-full max-w-xs text-sm text-muted"
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">Notes (optional)</label>
          <input
            name="notes"
            className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
            placeholder="e.g. March Denver export"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
      {error && (
        <p className="rounded-md bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-fg)]">{error}</p>
      )}
      {result && (
        <p className="rounded-md bg-[var(--status-success-bg)] px-3 py-2 text-sm text-[var(--status-success-fg)]">
          Imported <strong>{result.filename}</strong>: {result.insertedCount} inserted,{" "}
          {result.skippedDupes} skipped (dupes) of {result.rowCount} rows.
        </p>
      )}
    </form>
  );
}
