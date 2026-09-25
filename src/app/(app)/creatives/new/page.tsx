"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewCreativePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please choose a file");
      return;
    }
    setError("");
    setLoading(true);
    const form = new FormData();
    form.set("name", name);
    if (notes) form.set("notes", notes);
    form.set("file", file);

    const res = await fetch("/api/creatives", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <Link href="/dashboard" className="text-sm text-accent hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Upload creative</h1>
        <p className="text-sm text-muted">
          Images: jpeg, png, webp · Videos: mp4, webm · Max 50MB · Starts as DRAFT
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
        {error && (
          <p className="rounded-md bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-fg)]">{error}</p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-muted">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted">File</label>
          <input
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent py-2.5 font-medium text-brand-bg hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Uploading…" : "Save as draft"}
        </button>
      </form>
    </div>
  );
}
