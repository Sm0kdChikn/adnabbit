"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlacementActions({ placementId }: { placementId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function approve() {
    setLoading("approve");
    setError("");
    const res = await fetch(`/api/admin/placements/${placementId}/approve`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setError(data.error || "Approve failed");
      return;
    }
    router.refresh();
  }

  async function reject() {
    if (!reason.trim()) {
      setError("Rejection reason is required");
      return;
    }
    setLoading("reject");
    setError("");
    const res = await fetch(`/api/admin/placements/${placementId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setError(data.error || "Reject failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="w-full max-w-full space-y-2">
      <button
        type="button"
        onClick={approve}
        disabled={!!loading}
        className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading === "approve" ? "Approving…" : "Approve"}
      </button>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Rejection reason (required to reject)"
        rows={2}
        className="w-full rounded-md border border-border px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={reject}
        disabled={!!loading}
        className="w-full rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
      >
        {loading === "reject" ? "Rejecting…" : "Reject"}
      </button>
      {error && <p className="text-xs text-[var(--status-danger-fg)]">{error}</p>}
    </div>
  );
}
