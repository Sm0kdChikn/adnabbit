"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Textarea } from "@/components/ui";

type Target = "creative" | "advertiser" | "host" | "screen";

const LABELS: Record<
  Target,
  { take: string; clear: string; confirmTake: string; confirmClear: string }
> = {
  creative: {
    take: "Emergency take-down",
    clear: "Clear take-down",
    confirmTake:
      "Take down this creative? It will be removed from all playlists immediately.",
    confirmClear:
      "Clear take-down? Creative will return to playlists if still APPROVED and in its schedule window.",
  },
  advertiser: {
    take: "Take down advertiser",
    clear: "Clear advertiser take-down",
    confirmTake:
      "Take down ALL creatives for this advertiser from every playlist?",
    confirmClear:
      "Clear advertiser take-down? Their creatives return if still approved and in window.",
  },
  host: {
    take: "Kill paid playback (venue)",
    clear: "Restore paid playback",
    confirmTake:
      "Empty paid playlists for ALL screens under this host? (idle/black OK)",
    confirmClear: "Restore paid playback for this host's screens?",
  },
  screen: {
    take: "Kill paid playback (screen)",
    clear: "Restore paid playback",
    confirmTake: "Empty the paid playlist for this screen?",
    confirmClear: "Restore paid playback for this screen?",
  },
};

function apiPath(target: Target, id: string): string {
  if (target === "creative") return `/api/admin/creatives/${id}/take-down`;
  if (target === "advertiser") return `/api/admin/advertisers/${id}/take-down`;
  if (target === "host") return `/api/admin/hosts/${id}/take-down`;
  return `/api/admin/screens/${id}/take-down`;
}

export function TakeDownBadge({
  takenDownAt,
  reason,
  label = "Taken down",
}: {
  takenDownAt?: string | Date | null;
  reason?: string | null;
  label?: string;
}) {
  if (!takenDownAt) return null;
  const when =
    typeof takenDownAt === "string"
      ? new Date(takenDownAt)
      : takenDownAt;
  return (
    <span
      className="inline-flex flex-wrap items-center gap-1 rounded-full bg-[var(--status-danger-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-danger-fg)] ring-1 ring-inset ring-border"
      title={reason || undefined}
    >
      {label}
      <span className="font-normal opacity-80">
        · {when.toLocaleString()}
      </span>
    </span>
  );
}

export function TakeDownPanel({
  target,
  id,
  takenDownAt,
  reason,
  compact,
}: {
  target: Target;
  id: string;
  takenDownAt?: string | Date | null;
  reason?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const labels = LABELS[target];
  const isDown = !!takenDownAt;
  const [reasonDraft, setReasonDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function run(undo: boolean) {
    const confirmMsg = undo ? labels.confirmClear : labels.confirmTake;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    setError("");
    setMsg("");
    const res = await fetch(apiPath(target, id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        undo,
        reason: undo ? null : reasonDraft.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Request failed");
      return;
    }
    setMsg(
      undo
        ? `Cleared. Epoch bumped on ${data.affectedDevices ?? 0} device(s).`
        : `Taken down. Epoch bumped on ${data.affectedDevices ?? 0} device(s).`
    );
    setReasonDraft("");
    router.refresh();
  }

  return (
    <div
      className={
        compact
          ? "space-y-2"
          : "space-y-3 rounded-xl border border-border bg-surface p-4"
      }
    >
      {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Emergency take-down
          </h3>
          <TakeDownBadge takenDownAt={takenDownAt} reason={reason} />
        </div>
      )}
      {compact && <TakeDownBadge takenDownAt={takenDownAt} reason={reason} />}
      {isDown && reason && (
        <p className="text-xs text-[var(--status-danger-fg)]">
          Reason: {reason}
        </p>
      )}
      {!isDown && (
        <Textarea
          value={reasonDraft}
          onChange={(e) => setReasonDraft(e.target.value)}
          placeholder="Optional reason"
          rows={compact ? 2 : 2}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {isDown ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => run(true)}
          >
            {loading ? "Working…" : labels.clear}
          </Button>
        ) : (
          <Button
            variant="danger"
            size="sm"
            disabled={loading}
            onClick={() => run(false)}
          >
            {loading ? "Working…" : labels.take}
          </Button>
        )}
      </div>
      {error && (
        <p className="text-xs text-[var(--status-danger-fg)]">{error}</p>
      )}
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </div>
  );
}
