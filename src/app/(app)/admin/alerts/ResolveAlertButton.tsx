"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResolveAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onResolve() {
    setBusy(true);
    try {
      await fetch(`/api/admin/alerts/${alertId}/resolve`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onResolve}
      className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:border-accent/40 hover:text-accent disabled:opacity-50"
    >
      {busy ? "…" : "Resolve"}
    </button>
  );
}
