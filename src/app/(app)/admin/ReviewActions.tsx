"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Textarea } from "@/components/ui";

export function ReviewActions({ creativeId }: { creativeId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function approve() {
    setLoading("approve");
    setError("");
    const res = await fetch(`/api/creatives/${creativeId}/approve`, { method: "POST" });
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
    const res = await fetch(`/api/creatives/${creativeId}/reject`, {
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
      <Button
        variant="success"
        size="sm"
        className="w-full"
        onClick={approve}
        disabled={!!loading}
      >
        {loading === "approve" ? "Approving…" : "Approve"}
      </Button>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Rejection reason (required to reject)"
        rows={2}
      />
      <Button
        variant="danger"
        size="sm"
        className="w-full"
        onClick={reject}
        disabled={!!loading}
      >
        {loading === "reject" ? "Rejecting…" : "Reject"}
      </Button>
      {error && <p className="text-xs text-[var(--status-danger-fg)]">{error}</p>}
    </div>
  );
}
