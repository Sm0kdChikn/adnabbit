"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

type Props = {
  screenId: string;
  /** Paired device with recent heartbeat available */
  deviceOnline: boolean;
  hasDevice: boolean;
};

type Status =
  | "idle"
  | "requesting"
  | "waiting"
  | "ready"
  | "timeout"
  | "error";

const POLL_MS = 2500;
const TIMEOUT_MS = 30_000;
const LIVE_REFRESH_MS = 4000;

export function RemoteViewPanel({ screenId, deviceOnline, hasDevice }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const requestGen = useRef(0);
  /** ISO timestamp of capture we already showed; wait for newer. */
  const lastSeenCaptureRef = useRef<string | null>(null);
  const waitStartedRef = useRef(0);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearLive = useCallback(() => {
    if (liveRef.current) {
      clearInterval(liveRef.current);
      liveRef.current = null;
    }
  }, []);

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPoll();
      clearLive();
      revokeBlob();
    };
  }, [clearPoll, clearLive, revokeBlob]);

  async function fetchImageBlob(): Promise<{
    ok: boolean;
    pending?: boolean;
    url?: string;
    capturedAt?: string | null;
    error?: string;
  }> {
    const res = await fetch(`/api/admin/screens/${screenId}/remote-view`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.status === 202) {
      return { ok: false, pending: true };
    }
    if (res.status === 404) {
      return { ok: false, pending: true };
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const captured = res.headers.get("X-Remote-View-Captured-At") || null;
    return { ok: true, url, capturedAt: captured };
  }

  function applyImage(url: string, captured: string | null) {
    revokeBlob();
    blobUrlRef.current = url;
    setImageUrl(url);
    setCapturedAt(captured);
    if (captured) lastSeenCaptureRef.current = captured;
    setStatus("ready");
    setError("");
  }

  function startWaitingPoll(gen: number) {
    clearPoll();
    waitStartedRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (gen !== requestGen.current) {
        clearPoll();
        return;
      }
      if (Date.now() - waitStartedRef.current > TIMEOUT_MS) {
        clearPoll();
        setStatus((s) => (s === "ready" ? s : "timeout"));
        setError((prev) =>
          prev || "Timed out waiting for screenshot (~30s). Try again."
        );
        return;
      }
      const img = await fetchImageBlob();
      if (gen !== requestGen.current) return;
      if (img.ok && img.url) {
        const newer =
          !lastSeenCaptureRef.current ||
          !img.capturedAt ||
          img.capturedAt !== lastSeenCaptureRef.current;
        if (newer) {
          applyImage(img.url, img.capturedAt ?? null);
          clearPoll();
          return;
        }
        // Same stale image — revoke unused blob
        URL.revokeObjectURL(img.url);
        return;
      }
      if (img.error) {
        setError(img.error);
        setStatus("error");
        clearPoll();
      }
    }, POLL_MS);
  }

  async function requestCapture(opts?: { silent?: boolean }) {
    const gen = ++requestGen.current;
    if (!opts?.silent) {
      setStatus("requesting");
      setError("");
    }
    const res = await fetch(`/api/admin/screens/${screenId}/remote-view`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (gen !== requestGen.current) return;
    if (!res.ok) {
      setStatus("error");
      setError(data.error || "Failed to request remote view");
      clearPoll();
      return;
    }
    if (data.status === "ready") {
      const img = await fetchImageBlob();
      if (gen !== requestGen.current) return;
      if (img.ok && img.url) {
        applyImage(img.url, img.capturedAt ?? data.capturedAt ?? null);
        return;
      }
    }
    setStatus("waiting");
    startWaitingPoll(gen);
  }

  function onViewScreen() {
    if (!hasDevice || !deviceOnline) return;
    void requestCapture();
  }

  function onToggleLive(next: boolean) {
    setLive(next);
    clearLive();
    if (next) {
      void requestCapture({ silent: true });
      liveRef.current = setInterval(() => {
        void requestCapture({ silent: true });
      }, LIVE_REFRESH_MS);
    }
  }

  const disabled = !hasDevice || !deviceOnline;
  const busy = status === "requesting" || status === "waiting";

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Remote view</h2>
          <p className="text-sm text-muted">
            On-demand screenshot from the paired player (Ticket P). No mouse/keyboard
            control — for live OS remoting use Tailscale + wayvnc (ops path B).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onViewScreen}
            disabled={disabled || busy}
            title={
              !hasDevice
                ? "Pair a device first"
                : !deviceOnline
                  ? "Player offline (no recent heartbeat)"
                  : "Request a screenshot"
            }
          >
            {busy ? "Capturing…" : "View screen"}
          </Button>
          <label
            className={`inline-flex items-center gap-2 text-sm ${
              disabled ? "cursor-not-allowed text-muted" : "text-foreground"
            }`}
          >
            <input
              type="checkbox"
              className="rounded border-border"
              checked={live}
              disabled={disabled}
              onChange={(e) => onToggleLive(e.target.checked)}
            />
            Live refresh
          </label>
        </div>
      </div>

      {status === "waiting" && (
        <p className="text-sm text-muted">
          Waiting for player capture (next heartbeat ≤ ~60s, then upload)…
        </p>
      )}
      {status === "timeout" && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {error || "Timed out waiting for screenshot."}
        </p>
      )}
      {error && status === "error" && (
        <p className="text-sm text-[var(--status-danger-fg)]">{error}</p>
      )}
      {!hasDevice && (
        <p className="text-sm text-muted">No device paired — mint a claim code first.</p>
      )}
      {hasDevice && !deviceOnline && (
        <p className="text-sm text-muted">
          Player appears offline (no heartbeat within ~5 min).
        </p>
      )}

      {imageUrl && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Device screen preview"
            className="max-h-[420px] w-full rounded-lg border border-border bg-black object-contain"
          />
          {capturedAt && (
            <p className="text-xs text-muted">
              Captured {new Date(capturedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
