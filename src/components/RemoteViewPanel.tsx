"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { DeviceStatusBadge } from "@/components/DeviceStatusBadge";
import type { DeviceDisplayStatus } from "@/lib/open-hours";

type Props = {
  screenId: string;
  /** Paired device with recent heartbeat available */
  deviceOnline: boolean;
  hasDevice: boolean;
  /** Ticket Q — closed hours vs offline vs empty vs live */
  displayStatus?: DeviceDisplayStatus;
  hoursOpen?: boolean;
  hoursSummary?: string | null;
  forceLiveUntil?: string | null;
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

/** Map KeyboardEvent → Electron-style keyCode for sendInputEvent. */
function electronKeyCode(e: KeyboardEvent): string | null {
  switch (e.key) {
    case "Enter":
      return "Return";
    case "Escape":
      return "Escape";
    case "Backspace":
      return "Backspace";
    case "Tab":
      return "Tab";
    case "ArrowLeft":
      return "Left";
    case "ArrowRight":
      return "Right";
    case "ArrowUp":
      return "Up";
    case "ArrowDown":
      return "Down";
    case " ":
      return "Space";
    case "Delete":
      return "Delete";
    default:
      break;
  }
  // Printable single char (letters, digits, punctuation)
  if (e.key.length === 1) return e.key;
  return null;
}

function keyModifiers(
  e: KeyboardEvent
): Array<"shift" | "control" | "alt" | "meta"> {
  const m: Array<"shift" | "control" | "alt" | "meta"> = [];
  if (e.shiftKey) m.push("shift");
  if (e.ctrlKey) m.push("control");
  if (e.altKey) m.push("alt");
  if (e.metaKey) m.push("meta");
  return m;
}

/** Browser shortcuts that would navigate away / steal focus — do not forward. */
function isBrowserNavShortcut(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey) {
    if (["l", "t", "w", "n", "r", "p", "s", "o", "h", "j", "d"].includes(key)) {
      return true;
    }
    if (e.key === "Tab") return true;
  }
  if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return true;
  return false;
}

/**
 * Map click on an object-contain <img> to natural image / capture coordinates.
 */
function mapClickToCapture(
  img: HTMLImageElement,
  clientX: number,
  clientY: number
): { x: number; y: number; captureWidth: number; captureHeight: number } | null {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return null;
  const rect = img.getBoundingClientRect();
  const scale = Math.min(rect.width / natW, rect.height / natH);
  const dispW = natW * scale;
  const dispH = natH * scale;
  const offsetX = (rect.width - dispW) / 2;
  const offsetY = (rect.height - dispH) / 2;
  const x = (clientX - rect.left - offsetX) / scale;
  const y = (clientY - rect.top - offsetY) / scale;
  if (x < 0 || y < 0 || x > natW || y > natH) return null;
  return {
    x: Math.round(x),
    y: Math.round(y),
    captureWidth: natW,
    captureHeight: natH,
  };
}

export function RemoteViewPanel({
  screenId,
  deviceOnline,
  hasDevice,
  displayStatus,
  hoursOpen,
  hoursSummary,
  forceLiveUntil,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [controlOn, setControlOn] = useState(false);
  const [controlFocused, setControlFocused] = useState(false);
  const [controlHint, setControlHint] = useState("");
  const [controlError, setControlError] = useState("");
  /** Ticket P.1.1 — intended kiosk lock state after last successful command (optimistic). */
  const [kioskLocked, setKioskLocked] = useState(true);
  const [kioskBusy, setKioskBusy] = useState(false);
  /** Ticket P.1.2 — OS reboot command in flight. */
  const [rebootBusy, setRebootBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const requestGen = useRef(0);
  /** ISO timestamp of capture we already showed; wait for newer. */
  const lastSeenCaptureRef = useRef<string | null>(null);
  const waitStartedRef = useRef(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const eventQueueRef = useRef<unknown[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, [clearPoll, clearLive, revokeBlob]);

  async function flushControlQueue() {
    const batch = eventQueueRef.current;
    eventQueueRef.current = [];
    flushTimerRef.current = null;
    if (batch.length === 0) return;
    try {
      const res = await fetch(
        `/api/admin/screens/${screenId}/remote-control`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: batch }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setControlError(data.error || `Control failed (HTTP ${res.status})`);
        return;
      }
      setControlError("");
      setControlHint(
        `Queued ${data.queued ?? batch.length} → player (queue ${data.queueLength ?? "?"})`
      );
    } catch (e) {
      setControlError(e instanceof Error ? e.message : "Control send failed");
    }
  }

  function enqueueControl(events: unknown | unknown[]) {
    if (!controlOn || !hasDevice || !deviceOnline) return;
    const list = Array.isArray(events) ? events : [events];
    eventQueueRef.current.push(...list);
    if (flushTimerRef.current) return;
    // Batch briefly so click + char bursts share one POST
    flushTimerRef.current = setTimeout(() => {
      void flushControlQueue();
    }, 40);
  }

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

  function onToggleControl(next: boolean) {
    setControlOn(next);
    setControlError("");
    setControlHint(next ? "Click preview + type while focused" : "");
    if (next) {
      // Focus surface so keyboard works immediately
      requestAnimationFrame(() => surfaceRef.current?.focus());
    }
  }

  function onPreviewClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!controlOn) return;
    const img = imgRef.current;
    if (!img) return;
    const mapped = mapClickToCapture(img, e.clientX, e.clientY);
    if (!mapped) return;
    e.preventDefault();
    surfaceRef.current?.focus();
    enqueueControl([
      {
        type: "mouseClick",
        x: mapped.x,
        y: mapped.y,
        button: e.button === 2 ? "right" : e.button === 1 ? "middle" : "left",
        clickCount: e.detail || 1,
        captureWidth: mapped.captureWidth,
        captureHeight: mapped.captureHeight,
      },
    ]);
  }

  function onPreviewMouseMove(e: React.MouseEvent<HTMLImageElement>) {
    if (!controlOn) return;
    // Cheap hover: throttle via batching; only send occasional moves
    if (Math.random() > 0.08) return;
    const img = imgRef.current;
    if (!img) return;
    const mapped = mapClickToCapture(img, e.clientX, e.clientY);
    if (!mapped) return;
    enqueueControl({
      type: "mouseMove",
      x: mapped.x,
      y: mapped.y,
      captureWidth: mapped.captureWidth,
      captureHeight: mapped.captureHeight,
    });
  }

  function onSurfaceKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!controlOn) return;
    const native = e.nativeEvent;
    if (isBrowserNavShortcut(native)) {
      // Let browser handle (or ignore) — do not forward
      return;
    }
    const keyCode = electronKeyCode(native);
    if (!keyCode) return;
    e.preventDefault();
    e.stopPropagation();
    const modifiers = keyModifiers(native);
    enqueueControl({ type: "keyDown", keyCode, modifiers });
    // Printable chars also need a char event for Electron text input
    if (native.key.length === 1 && !native.ctrlKey && !native.metaKey && !native.altKey) {
      enqueueControl({ type: "char", keyCode: native.key, modifiers });
    }
  }

  function onSurfaceKeyUp(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!controlOn) return;
    const native = e.nativeEvent;
    if (isBrowserNavShortcut(native)) return;
    const keyCode = electronKeyCode(native);
    if (!keyCode) return;
    e.preventDefault();
    e.stopPropagation();
    enqueueControl({
      type: "keyUp",
      keyCode,
      modifiers: keyModifiers(native),
    });
  }

  /**
   * Ticket P.1.1 — queue setKiosk so Brandon can unlock for mini-PC troubleshooting
   * then re-lock. Uses the same admin + paired + freshness gate as remote-control.
   */
  async function sendKioskCommand(locked: boolean) {
    if (!hasDevice || !deviceOnline || kioskBusy) return;
    setKioskBusy(true);
    setControlError("");
    try {
      const res = await fetch(
        `/api/admin/screens/${screenId}/remote-control`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [{ type: "command", name: "setKiosk", enabled: locked }],
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setControlError(
          data.error || `Kiosk command failed (HTTP ${res.status})`
        );
        return;
      }
      setKioskLocked(locked);
      setControlHint(
        locked
          ? `Enable kiosk queued → player (queue ${data.queueLength ?? "?"})`
          : `Disable kiosk queued → player (queue ${data.queueLength ?? "?"})`
      );
    } catch (e) {
      setControlError(
        e instanceof Error ? e.message : "Kiosk command failed"
      );
    } finally {
      setKioskBusy(false);
    }
  }


  /**
   * Ticket P.1.2 — queue OS reboot (player runs adnabbit-reboot helper after clean quit).
   * Same admin + paired + freshness gate as remote-control / setKiosk.
   */
  async function sendRebootCommand() {
    if (!hasDevice || !deviceOnline || rebootBusy) return;
    const ok = window.confirm(
      "Reboot this device now?\n\n" +
        "The player will quit cleanly, then reboot the mini-PC OS. " +
        "Playback will resume after boot if autostart is installed."
    );
    if (!ok) return;
    setRebootBusy(true);
    setControlError("");
    try {
      const res = await fetch(
        `/api/admin/screens/${screenId}/remote-control`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [{ type: "command", name: "reboot" }],
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setControlError(
          data.error || `Reboot command failed (HTTP ${res.status})`
        );
        return;
      }
      setControlHint(
        `Reboot queued → player (queue ${data.queueLength ?? "?"})`
      );
    } catch (e) {
      setControlError(
        e instanceof Error ? e.message : "Reboot command failed"
      );
    } finally {
      setRebootBusy(false);
    }
  }

  const disabled = !hasDevice || !deviceOnline;
  const busy = status === "requesting" || status === "waiting";
  const canControl = !disabled && status === "ready" && !!imageUrl;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Remote view</h2>
          <p className="text-sm text-muted">
            On-demand screenshot from the paired player (Ticket P). Enable{" "}
            <strong>Remote control</strong> for mouse/keyboard (Ticket P.1).
            Use <strong>Kiosk locked</strong> to unlock lockdown for mini-PC
            troubleshooting, then re-lock (Ticket P.1.1).{" "}
            <strong>Reboot device</strong> queues a full OS reboot (Ticket P.1.2).
          </p>
          {displayStatus && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DeviceStatusBadge status={displayStatus} />
              {hoursSummary ? (
                <span className="text-xs text-muted">{hoursSummary}</span>
              ) : null}
              {forceLiveUntil ? (
                <span className="text-xs text-accent">
                  Force live until {new Date(forceLiveUntil).toLocaleString()}
                </span>
              ) : null}
              {displayStatus === "BLACKOUT" ? (
                <span className="text-xs text-muted">
                  Soft blackout — player dark, PoP muted
                </span>
              ) : null}
            </div>
          )}
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
          <label
            className={`inline-flex items-center gap-2 text-sm ${
              !canControl && !controlOn
                ? "cursor-not-allowed text-muted"
                : "text-foreground"
            }`}
          >
            <input
              type="checkbox"
              className="rounded border-border"
              checked={controlOn}
              disabled={!canControl && !controlOn}
              onChange={(e) => onToggleControl(e.target.checked)}
            />
            Remote control
          </label>
          <label
            className={`inline-flex items-center gap-2 text-sm ${
              disabled || kioskBusy
                ? "cursor-not-allowed text-muted"
                : "text-foreground"
            }`}
            title={
              !hasDevice
                ? "Pair a device first"
                : !deviceOnline
                  ? "Player offline (no recent heartbeat)"
                  : kioskLocked
                    ? "Uncheck to unlock kiosk (window + Escape) for mini-PC troubleshooting"
                    : "Check to re-enable Electron kiosk lockdown"
            }
          >
            <input
              type="checkbox"
              className="rounded border-border"
              checked={kioskLocked}
              disabled={disabled || kioskBusy}
              onChange={(e) => void sendKioskCommand(e.target.checked)}
            />
            {kioskBusy
              ? "Kiosk…"
              : kioskLocked
                ? "Kiosk locked"
                : "Unlocked"}
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void sendRebootCommand()}
            disabled={disabled || rebootBusy}
            title={
              !hasDevice
                ? "Pair a device first"
                : !deviceOnline
                  ? "Player offline (no recent heartbeat)"
                  : "Queue OS reboot on the paired mini-PC"
            }
          >
            {rebootBusy ? "Rebooting…" : "Reboot device"}
          </Button>
        </div>
      </div>

      {!kioskLocked && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          <span className="font-medium">Kiosk unlocked</span>
          <span className="text-muted">
            {" "}
            — intended state after last command; player should be windowed so you
            can use the desktop around it. Re-check <strong>Kiosk locked</strong>{" "}
            when done.
          </span>
          {controlHint ? (
            <span className="ml-2 text-xs text-muted">{controlHint}</span>
          ) : null}
        </div>
      )}

      {controlOn && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            controlFocused
              ? "border-accent bg-accent/10 text-foreground"
              : "border-border bg-muted/20 text-muted"
          }`}
        >
          <span className="font-medium text-foreground">
            Remote control on
          </span>
          {controlFocused
            ? " — keyboard focused; click preview to click, type here"
            : " — click the preview to focus keyboard"}
          {controlHint ? (
            <span className="ml-2 text-xs text-muted">{controlHint}</span>
          ) : null}
        </div>
      )}

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
      {controlError && (
        <p className="text-sm text-[var(--status-danger-fg)]">{controlError}</p>
      )}
      {!hasDevice && (
        <p className="text-sm text-muted">No device paired — mint a claim code first.</p>
      )}
      {hasDevice && !deviceOnline && (
        <p className="text-sm text-muted">
          Player appears offline (no heartbeat within ~5 min)
          {hoursOpen === false
            ? " — note: venue would also be outside open hours right now"
            : ""}
          .
        </p>
      )}
      {hasDevice && deviceOnline && displayStatus === "BLACKOUT" && (
        <p className="text-sm text-muted">
          Device is online but dark due to closed venue hours (soft blackout).
          Proof-of-play is muted until open / force-live.
        </p>
      )}

      {imageUrl && (
        <div className="space-y-2">
          <div
            ref={surfaceRef}
            tabIndex={controlOn ? 0 : -1}
            onFocus={() => setControlFocused(true)}
            onBlur={() => setControlFocused(false)}
            onKeyDown={onSurfaceKeyDown}
            onKeyUp={onSurfaceKeyUp}
            className={`rounded-lg outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent ${
              controlOn ? "cursor-crosshair" : ""
            }`}
            aria-label={
              controlOn
                ? "Remote control surface — click image and type"
                : "Remote view preview"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Device screen preview"
              className={`max-h-[420px] w-full rounded-lg border border-border bg-black object-contain ${
                controlOn ? "cursor-crosshair" : ""
              }`}
              onClick={onPreviewClick}
              onMouseMove={onPreviewMouseMove}
              onContextMenu={(e) => {
                if (controlOn) e.preventDefault();
              }}
              draggable={false}
            />
          </div>
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
