"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { DeviceStatusBadge } from "@/components/DeviceStatusBadge";
import type { DeviceDisplayStatus } from "@/lib/open-hours";

type Props = {
  screenId: string;
  /** admin | host — selects mint endpoint */
  role: "admin" | "host";
  device?: {
    id: string;
    name: string | null;
    lastSeenAt: string | null;
    claimedAt: string;
  } | null;
  displayStatus?: DeviceDisplayStatus;
};

export function ClaimDevicePanel({ screenId, role, device, displayStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshMsg, setRefreshMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const mintPath =
    role === "admin"
      ? `/api/admin/screens/${screenId}/claim`
      : `/api/host/screens/${screenId}/claim`;

  const refreshPath =
    role === "admin"
      ? `/api/admin/screens/${screenId}/refresh-playlist`
      : `/api/host/screens/${screenId}/refresh-playlist`;

  async function mint() {
    setLoading(true);
    setError("");
    setCode(null);
    setExpiresAt(null);
    const res = await fetch(mintPath, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to mint claim code");
      return;
    }
    setCode(data.code);
    setExpiresAt(data.expiresAt);
    router.refresh();
  }

  async function refreshPlaylist() {
    setRefreshLoading(true);
    setRefreshMsg(null);
    setError("");
    const res = await fetch(refreshPath, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setRefreshLoading(false);
    if (!res.ok) {
      setRefreshMsg({
        kind: "err",
        text: data.error || "Failed to refresh playlist",
      });
      return;
    }
    setRefreshMsg({
      kind: "ok",
      text: `Refresh signaled (epoch ${data.playlistEpoch}) — player will re-fetch on next heartbeat (~60s max)`,
    });
    router.refresh();
  }

  const lastSeenLabel = device?.lastSeenAt
    ? new Date(device.lastSeenAt).toLocaleString()
    : null;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Player device</h2>
          <p className="text-sm text-muted">
            Mint a one-time claim code (15 min) to pair a Linux kiosk player.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={refreshPlaylist}
            disabled={!device || refreshLoading}
            title={
              device
                ? "Bump playlist epoch so the paired player re-fetches ASAP"
                : "Pair a device first"
            }
          >
            {refreshLoading ? "Signaling…" : "Refresh playlist"}
          </Button>
          <Button variant="primary" size="sm" onClick={mint} disabled={loading}>
            {loading ? "Minting…" : "Mint claim code"}
          </Button>
        </div>
      </div>

      {device ? (
        <div className="rounded-lg border border-border bg-background-elevated px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">
              Paired{device.name ? `: ${device.name}` : ""}
            </p>
            {displayStatus ? <DeviceStatusBadge status={displayStatus} /> : null}
          </div>
          <p className="text-muted">
            Last seen:{" "}
            <span className="text-foreground">
              {lastSeenLabel || "never"}
            </span>
          </p>
          <p className="text-xs text-muted">
            Claimed {new Date(device.claimedAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">No device paired yet.</p>
      )}

      {code && (
        <div className="rounded-lg border border-accent/40 bg-accent-dim px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-accent">Claim code</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-accent">
            {code}
          </p>
          {expiresAt && (
            <p className="mt-1 text-xs text-muted">
              Expires {new Date(expiresAt).toLocaleString()} · one-time use
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            On the player:{" "}
            <code className="text-foreground">npm run claim -- --code {code}</code>
          </p>
        </div>
      )}

      {refreshMsg && (
        <p
          className={
            refreshMsg.kind === "ok"
              ? "text-sm text-emerald-600 dark:text-emerald-400"
              : "text-sm text-[var(--status-danger-fg)]"
          }
        >
          {refreshMsg.text}
        </p>
      )}

      {error && (
        <p className="text-sm text-[var(--status-danger-fg)]">{error}</p>
      )}
    </section>
  );
}
