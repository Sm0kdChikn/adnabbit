import type { ReactNode } from "react";

/** Decorative faux venue-screen cards — CSS/SVG only, no stock photos. */

function ScreenChrome({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-background-elevated shadow-card ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-surface px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400/80" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-strong">
          {label}
        </span>
      </div>
      <div className="relative aspect-[16/10] bg-brand-bg">{children}</div>
    </div>
  );
}

export function VenueScreenMocks() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      {/* Back card — schedule / control plane */}
      <div className="absolute -right-2 top-8 w-[78%] rotate-3 opacity-90 sm:right-0 sm:w-[72%] lg:rotate-6">
        <ScreenChrome label="Screen · Lobby A">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(0,229,255,0.18),transparent_55%)]" />
          <div className="absolute inset-0 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-medium text-brand-muted">Today&apos;s playlist</span>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-semibold text-accent">
                LIVE
              </span>
            </div>
            <div className="space-y-2">
              {[
                { name: "Summer Promo", pct: "92%" },
                { name: "Venue Welcome", pct: "78%" },
                { name: "Local Offer", pct: "64%" },
              ].map((row) => (
                <div
                  key={row.name}
                  className="flex items-center gap-2 rounded-md border border-brand-border/80 bg-brand-elevated/80 px-2.5 py-1.5"
                >
                  <div className="h-6 w-6 shrink-0 rounded bg-gradient-to-br from-accent/40 to-accent/10" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] text-brand-text">{row.name}</div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-brand-border">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: row.pct }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-[9px] text-brand-muted">{row.pct}</span>
                </div>
              ))}
            </div>
          </div>
        </ScreenChrome>
      </div>

      {/* Front card — creative frame */}
      <div className="relative z-10 w-[86%] -rotate-2 sm:w-[80%] lg:-rotate-3">
        <ScreenChrome label="Creative preview">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 320 200"
            fill="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="adGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.35" />
                <stop offset="50%" stopColor="#0B0F14" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.15" />
              </linearGradient>
              <pattern
                id="grid"
                width="16"
                height="16"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 16 0 L 0 0 0 16"
                  fill="none"
                  stroke="#243041"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="320" height="200" fill="#0B0F14" />
            <rect width="320" height="200" fill="url(#grid)" />
            <rect width="320" height="200" fill="url(#adGrad)" />
            {/* Faux ad creative frame */}
            <rect
              x="24"
              y="28"
              width="272"
              height="120"
              rx="8"
              stroke="#00E5FF"
              strokeOpacity="0.45"
              strokeWidth="1.5"
              fill="#12181F"
              fillOpacity="0.7"
            />
            <circle cx="88" cy="78" r="28" fill="#00E5FF" fillOpacity="0.2" />
            <circle cx="88" cy="78" r="18" fill="#00E5FF" fillOpacity="0.35" />
            <rect x="132" y="58" width="140" height="10" rx="3" fill="#E8EEF6" fillOpacity="0.85" />
            <rect x="132" y="76" width="110" height="7" rx="2" fill="#94A3B8" fillOpacity="0.7" />
            <rect x="132" y="92" width="96" height="7" rx="2" fill="#94A3B8" fillOpacity="0.45" />
            <rect
              x="132"
              y="112"
              width="72"
              height="18"
              rx="4"
              fill="#00E5FF"
              fillOpacity="0.9"
            />
            {/* Bottom ticker */}
            <rect y="168" width="320" height="32" fill="#12181F" fillOpacity="0.95" />
            <text
              x="16"
              y="188"
              fill="#00E5FF"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              letterSpacing="0.08em"
            >
              DEDICATED · VENUE SCREEN · PROOF OF PLAY
            </text>
          </svg>
        </ScreenChrome>
      </div>

      {/* Accent glow behind stack */}
      <div
        className="pointer-events-none absolute -bottom-8 left-1/4 h-32 w-1/2 rounded-full bg-accent/20 blur-3xl"
        aria-hidden
      />
    </div>
  );
}
