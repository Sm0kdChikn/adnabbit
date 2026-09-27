"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

type Props = {
  screenId: string;
  /** Sticky screen overrides (null = inherit) */
  stickyVolume: number | null;
  stickyBrightness: number | null;
  /** Resolved effective levels after inherit */
  resolvedVolume: number;
  resolvedBrightness: number;
  volumeSource?: string;
  brightnessSource?: string;
  hostDefaultVolume?: number | null;
  hostDefaultBrightness?: number | null;
  /** Last player-reported applied levels */
  lastAppliedVolume?: number | null;
  lastAppliedBrightness?: number | null;
  hasDevice?: boolean;
  deviceOnline?: boolean;
  /** Compact mode for embedding in Remote view */
  compact?: boolean;
};

/**
 * Ticket Y — volume / brightness sticky prefs + confirm/apply to player.
 * Soft miss: host self-service, fleet bulk.
 */
export function OutputControlPanel({
  screenId,
  stickyVolume,
  stickyBrightness,
  resolvedVolume,
  resolvedBrightness,
  volumeSource = "default",
  brightnessSource = "default",
  hostDefaultVolume = null,
  hostDefaultBrightness = null,
  lastAppliedVolume = null,
  lastAppliedBrightness = null,
  hasDevice = false,
  deviceOnline = false,
  compact = false,
}: Props) {
  const router = useRouter();
  const [volume, setVolume] = useState(
    stickyVolume ?? resolvedVolume
  );
  const [brightness, setBrightness] = useState(
    stickyBrightness ?? resolvedBrightness
  );
  const [inheritVolume, setInheritVolume] = useState(stickyVolume == null);
  const [inheritBrightness, setInheritBrightness] = useState(
    stickyBrightness == null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function submit(apply: boolean) {
    if (apply) {
      const ok = window.confirm(
        `Apply volume ${inheritVolume ? "(inherit → " + resolvedVolume + ")" : volume}% ` +
          `and brightness ${inheritBrightness ? "(inherit → " + resolvedBrightness + ")" : brightness}% ` +
          `to the player now?\n\nSticky prefs will be saved; setOutput will be queued.`
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const body: {
        volume?: number | null;
        brightness?: number | null;
        apply?: boolean;
      } = { apply };
      body.volume = inheritVolume ? null : volume;
      body.brightness = inheritBrightness ? null : brightness;

      const res = await fetch(`/api/admin/screens/${screenId}/output`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error ||
            (res.status === 409
              ? "Device unpaired or offline"
              : `Save failed (HTTP ${res.status})`)
        );
        if (data.prefsSaved) {
          setOkMsg("Prefs saved (apply skipped — device offline/unpaired)");
          router.refresh();
        }
        return;
      }
      setOkMsg(
        apply
          ? data.queued
            ? `Applied — setOutput queued (queue ${data.queueLength ?? "?"})`
            : "Saved (nothing queued)"
          : "Sticky prefs saved"
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={
        compact
          ? "space-y-3 rounded-lg border border-border bg-background/50 p-3"
          : "space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5"
      }
    >
      <div>
        <h2
          className={
            compact
              ? "text-sm font-semibold text-foreground"
              : "text-lg font-semibold text-foreground"
          }
        >
          Volume & brightness
        </h2>
        <p className="mt-1 text-sm text-muted">
          Sticky screen prefs (null inherits host → defaults 80% / 100%). Confirm
          Apply to queue <code className="text-xs">setOutput</code> to the
          paired player. Soft miss: host self-service, fleet bulk.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-foreground">
              Volume: {inheritVolume ? `inherit (${resolvedVolume})` : `${volume}%`}
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                className="rounded border-border"
                checked={inheritVolume}
                onChange={(e) => setInheritVolume(e.target.checked)}
              />
              Inherit
            </label>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={inheritVolume ? resolvedVolume : volume}
            disabled={inheritVolume || busy}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <p className="text-xs text-muted">
            Source: {volumeSource}
            {hostDefaultVolume != null ? ` · host default ${hostDefaultVolume}` : ""}
            {lastAppliedVolume != null
              ? ` · last-applied ${lastAppliedVolume}`
              : " · last-applied —"}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-foreground">
              Brightness:{" "}
              {inheritBrightness
                ? `inherit (${resolvedBrightness})`
                : `${brightness}%`}
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                className="rounded border-border"
                checked={inheritBrightness}
                onChange={(e) => setInheritBrightness(e.target.checked)}
              />
              Inherit
            </label>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={inheritBrightness ? resolvedBrightness : brightness}
            disabled={inheritBrightness || busy}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <p className="text-xs text-muted">
            Source: {brightnessSource}
            {hostDefaultBrightness != null
              ? ` · host default ${hostDefaultBrightness}`
              : ""}
            {lastAppliedBrightness != null
              ? ` · last-applied ${lastAppliedBrightness}`
              : " · last-applied —"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => submit(false)}
        >
          {busy ? "Saving…" : "Save prefs"}
        </Button>
        <Button
          type="button"
          disabled={busy || !hasDevice || !deviceOnline}
          onClick={() => submit(true)}
          title={
            !hasDevice
              ? "Pair a device first"
              : !deviceOnline
                ? "Player offline"
                : "Save + queue setOutput"
          }
        >
          {busy ? "Applying…" : "Confirm & apply"}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-[var(--status-danger-fg)]">{error}</p>
      ) : null}
      {okMsg ? <p className="text-sm text-emerald-400">{okMsg}</p> : null}
    </section>
  );
}
