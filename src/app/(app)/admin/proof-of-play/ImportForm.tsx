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
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Import OptiSigns PoP CSV</h2>
        <p className="text-xs text-slate-500">
          Required headers: Report Date UTC, Account ID, Screen UUID, Screen Name, Screen Tags,
          Asset ID, Asset Name, Asset Tags, Start Time UTC, Device Local Time, Duration (seconds).
          Dupes skipped by rawHash. Host filler rows are flagged automatically.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">CSV file</label>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block w-full max-w-xs text-sm text-slate-700"
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">Notes (optional)</label>
          <input
            name="notes"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="e.g. March Denver export"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}
      {result && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Imported <strong>{result.filename}</strong>: {result.insertedCount} inserted,{" "}
          {result.skippedDupes} skipped (dupes) of {result.rowCount} rows.
        </p>
      )}
    </form>
  );
}
