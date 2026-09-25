"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function SubmitButton({ creativeId }: { creativeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/creatives/${creativeId}/submit`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Submit failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      <Button variant="warning" size="sm" onClick={submit} disabled={loading}>
        {loading ? "Submitting…" : "Submit for review"}
      </Button>
      {error && <p className="mt-1 text-xs text-[var(--status-danger-fg)]">{error}</p>}
    </div>
  );
}
