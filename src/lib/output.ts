/**
 * Ticket Y — volume / brightness prefs + resolve.
 * Screen null → inherit Host.default* → else defaults (80 / 100).
 * Sticky in DB. Soft miss: host self-service, fleet bulk.
 * Out: CEC TV, sensors, per-creative gain, OptiSigns; Z groups.
 */
import { prisma } from "./prisma";
import { writeAuditEvent } from "./audit";
import {
  appendPendingInput,
  isDeviceRecentlySeen,
  normalizeRemoteInputEvent,
  PLAYER_ONLINE_GRACE_MS,
  type RemoteInputEvent,
} from "./device";

export const DEFAULT_VOLUME = 80;
export const DEFAULT_BRIGHTNESS = 100;

export type OutputLevel = number; // 0–100

export type ResolvedOutput = {
  volume: number;
  brightness: number;
  /** Where volume came from */
  volumeSource: "screen" | "host" | "default";
  brightnessSource: "screen" | "host" | "default";
  /** Sticky screen overrides (null = inherit) */
  screenVolume: number | null;
  screenBrightness: number | null;
  hostDefaultVolume: number | null;
  hostDefaultBrightness: number | null;
};

/** Clamp / parse 0–100 int; null if invalid or explicitly clearing. */
export function normalizeOutputLevel(
  raw: unknown
): number | null | undefined {
  // undefined = not provided; null = clear sticky
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n < 0 || n > 100) return undefined; // signal invalid via separate check
    return Math.min(100, Math.max(0, n));
  }
  if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) {
    const n = parseInt(raw.trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
    return n;
  }
  return undefined;
}

/** Strict parse: returns { ok, value } where value is 0–100 or null (clear). */
export function parseOutputLevel(
  raw: unknown,
  field: string
):
  | { ok: true; value: number | null | undefined }
  | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n < 0 || n > 100) {
      return { ok: false, error: `${field} must be an integer 0–100` };
    }
    return { ok: true, value: n };
  }
  if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) {
    const n = parseInt(raw.trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { ok: false, error: `${field} must be an integer 0–100` };
    }
    return { ok: true, value: n };
  }
  return { ok: false, error: `${field} must be an integer 0–100 or null` };
}

export function resolveOutputLevels(opts: {
  screenVolume?: number | null;
  screenBrightness?: number | null;
  hostDefaultVolume?: number | null;
  hostDefaultBrightness?: number | null;
}): ResolvedOutput {
  let volume: number;
  let volumeSource: ResolvedOutput["volumeSource"];
  if (
    typeof opts.screenVolume === "number" &&
    Number.isFinite(opts.screenVolume)
  ) {
    volume = Math.min(100, Math.max(0, Math.round(opts.screenVolume)));
    volumeSource = "screen";
  } else if (
    typeof opts.hostDefaultVolume === "number" &&
    Number.isFinite(opts.hostDefaultVolume)
  ) {
    volume = Math.min(100, Math.max(0, Math.round(opts.hostDefaultVolume)));
    volumeSource = "host";
  } else {
    volume = DEFAULT_VOLUME;
    volumeSource = "default";
  }

  let brightness: number;
  let brightnessSource: ResolvedOutput["brightnessSource"];
  if (
    typeof opts.screenBrightness === "number" &&
    Number.isFinite(opts.screenBrightness)
  ) {
    brightness = Math.min(100, Math.max(0, Math.round(opts.screenBrightness)));
    brightnessSource = "screen";
  } else if (
    typeof opts.hostDefaultBrightness === "number" &&
    Number.isFinite(opts.hostDefaultBrightness)
  ) {
    brightness = Math.min(
      100,
      Math.max(0, Math.round(opts.hostDefaultBrightness))
    );
    brightnessSource = "host";
  } else {
    brightness = DEFAULT_BRIGHTNESS;
    brightnessSource = "default";
  }

  return {
    volume,
    brightness,
    volumeSource,
    brightnessSource,
    screenVolume:
      typeof opts.screenVolume === "number" ? opts.screenVolume : null,
    screenBrightness:
      typeof opts.screenBrightness === "number" ? opts.screenBrightness : null,
    hostDefaultVolume:
      typeof opts.hostDefaultVolume === "number"
        ? opts.hostDefaultVolume
        : null,
    hostDefaultBrightness:
      typeof opts.hostDefaultBrightness === "number"
        ? opts.hostDefaultBrightness
        : null,
  };
}

export async function resolveOutputForScreen(
  screenId: string
): Promise<ResolvedOutput> {
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: {
      volume: true,
      brightness: true,
      host: {
        select: { defaultVolume: true, defaultBrightness: true },
      },
    },
  });
  if (!screen) {
    return resolveOutputLevels({});
  }
  return resolveOutputLevels({
    screenVolume: screen.volume,
    screenBrightness: screen.brightness,
    hostDefaultVolume: screen.host?.defaultVolume,
    hostDefaultBrightness: screen.host?.defaultBrightness,
  });
}

/** Compact payload for claim/heartbeat/playlist. */
export function toOutputWire(resolved: ResolvedOutput): {
  volume: number;
  brightness: number;
  volumeSource: string;
  brightnessSource: string;
} {
  return {
    volume: resolved.volume,
    brightness: resolved.brightness,
    volumeSource: resolved.volumeSource,
    brightnessSource: resolved.brightnessSource,
  };
}

export type SaveScreenOutputResult =
  | {
      ok: true;
      resolved: ResolvedOutput;
      queued: boolean;
      queueLength?: number;
      dropped?: number;
    }
  | {
      ok: false;
      error: string;
      status: number;
      /** Prefs may already be persisted when apply fails (409). */
      prefsSaved?: boolean;
      resolved?: ResolvedOutput;
    };

/**
 * Persist sticky screen volume/brightness (null clears to inherit).
 * Optionally queue setOutput to paired online player.
 */
export async function saveAndMaybeApplyScreenOutput(opts: {
  screenId: string;
  actorUserId: string;
  volume?: number | null;
  brightness?: number | null;
  /** If true, queue setOutput when device paired + fresh. */
  apply?: boolean;
}): Promise<SaveScreenOutputResult> {
  const screen = await prisma.screen.findUnique({
    where: { id: opts.screenId },
    select: {
      id: true,
      volume: true,
      brightness: true,
      host: {
        select: { defaultVolume: true, defaultBrightness: true },
      },
      device: {
        select: {
          id: true,
          lastSeenAt: true,
          pendingInputJson: true,
        },
      },
    },
  });
  if (!screen) {
    return { ok: false, error: "Screen not found", status: 404 };
  }

  const data: { volume?: number | null; brightness?: number | null } = {};
  if (opts.volume !== undefined) data.volume = opts.volume;
  if (opts.brightness !== undefined) data.brightness = opts.brightness;

  if (Object.keys(data).length > 0) {
    await prisma.screen.update({
      where: { id: screen.id },
      data,
    });
  }

  const resolved = resolveOutputLevels({
    screenVolume:
      opts.volume !== undefined ? opts.volume : screen.volume,
    screenBrightness:
      opts.brightness !== undefined ? opts.brightness : screen.brightness,
    hostDefaultVolume: screen.host.defaultVolume,
    hostDefaultBrightness: screen.host.defaultBrightness,
  });

  let queued = false;
  let queueLength: number | undefined;
  let dropped: number | undefined;

  let applyError: string | null = null;

  if (opts.apply) {
    if (!screen.device) {
      applyError = "No device paired to this screen";
    } else if (!isDeviceRecentlySeen(screen.device.lastSeenAt)) {
      const graceMin = Math.round(PLAYER_ONLINE_GRACE_MS / 60_000);
      applyError = `Player appears offline (no heartbeat within ~${graceMin} min). Cannot send setOutput.`;
    } else {
      const event = normalizeRemoteInputEvent({
        type: "command",
        name: "setOutput",
        volume: resolved.volume,
        brightness: resolved.brightness,
      });
      if (!event) {
        return { ok: false, error: "Failed to build setOutput event", status: 500 };
      }

      const current = await prisma.device.findUnique({
        where: { id: screen.device.id },
        select: { pendingInputJson: true, lastSeenAt: true },
      });
      if (!current || !isDeviceRecentlySeen(current.lastSeenAt)) {
        applyError = "Player went offline";
      } else {
        const appended = appendPendingInput(current.pendingInputJson, [
          event as RemoteInputEvent,
        ]);
        await prisma.device.update({
          where: { id: screen.device.id },
          data: { pendingInputJson: appended.json },
        });
        queued = true;
        queueLength = appended.queueLength;
        dropped = appended.dropped;
      }
    }
  }

  await writeAuditEvent({
    actorUserId: opts.actorUserId,
    action: opts.apply && queued ? "output.apply" : "output.save",
    targetType: "screen",
    targetId: screen.id,
    meta: {
      volume: resolved.volume,
      brightness: resolved.brightness,
      screenVolume: resolved.screenVolume,
      screenBrightness: resolved.screenBrightness,
      queued,
      apply: !!opts.apply,
      applyError,
    },
  });

  if (opts.apply && applyError) {
    const fail: SaveScreenOutputResult = {
      ok: false,
      error: applyError,
      status: 409,
      prefsSaved: true,
      resolved,
    };
    return fail;
  }

  return {
    ok: true,
    resolved,
    queued,
    queueLength,
    dropped,
  };
}
