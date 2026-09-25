"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UnpublishButton({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!confirm("Unpublish this advertiser profile?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/unpublish`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="rounded-md bg-[var(--status-danger-bg)] px-3 py-1.5 text-sm font-medium text-[var(--status-danger-fg)] hover:bg-rose-100 disabled:opacity-50"
      >
        {busy ? "…" : "Unpublish"}
      </button>
      {error && <p className="mt-1 text-xs text-[var(--status-danger-fg)]">{error}</p>}
    </div>
  );
}
