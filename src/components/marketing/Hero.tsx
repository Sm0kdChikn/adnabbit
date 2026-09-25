import Link from "next/link";
import { VenueScreenMocks } from "./VenueScreenMocks";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Dot + line grid texture */}
      <div
        className="pointer-events-none absolute inset-0 marketing-hero-dots opacity-40 dark:opacity-50"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 marketing-hero-grid opacity-[0.25] dark:opacity-[0.35]"
        aria-hidden
      />
      {/* Cyan glow orbs */}
      <div
        className="pointer-events-none absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-3xl marketing-orb"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 top-24 h-96 w-96 rounded-full bg-accent/15 blur-3xl marketing-orb marketing-orb-delayed"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-accent/10 blur-3xl marketing-orb"
        aria-hidden
      />

      {/* Floating faux creative cards (background depth) */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
        <div className="marketing-float absolute left-[8%] top-[18%] w-36 -rotate-12 opacity-40">
          <div className="overflow-hidden rounded-lg border border-accent/20 bg-surface/80 shadow-glow-sm backdrop-blur-sm">
            <div className="aspect-video bg-gradient-to-br from-accent/30 via-brand-elevated to-brand-bg p-2">
              <div className="h-full rounded border border-accent/25 bg-brand-bg/60" />
            </div>
          </div>
        </div>
        <div className="marketing-float-delayed absolute right-[6%] top-[12%] w-40 rotate-6 opacity-35">
          <div className="overflow-hidden rounded-lg border border-border bg-surface/70 shadow-card backdrop-blur-sm">
            <div className="aspect-video bg-gradient-to-tr from-brand-elevated to-accent/20 p-2">
              <div className="mb-1 h-2 w-1/2 rounded bg-accent/50" />
              <div className="h-2 w-3/4 rounded bg-brand-muted/40" />
            </div>
          </div>
        </div>
        <div className="marketing-float absolute bottom-[12%] left-[4%] w-28 rotate-3 opacity-30">
          <div className="overflow-hidden rounded-md border border-accent/15 bg-brand-elevated/90 p-1.5 shadow-glow-sm">
            <div className="aspect-[4/3] rounded bg-gradient-to-b from-accent/25 to-transparent" />
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-28">
        <div className="text-center lg:text-left">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent-dim px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-glow-sm" />
            Dedicated venue screens
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
            Ads that live on{" "}
            <span className="bg-gradient-to-r from-accent via-cyan-300 to-accent bg-clip-text text-transparent dark:via-cyan-200">
              real screens
            </span>{" "}
            in real venues
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
            AdNabbit is the control plane for dedicated digital screens — gyms,
            waiting rooms, retail floors, and sports-bar second screens. Upload
            creatives, get them approved, schedule playback, and collect
            proof-of-play. Not a live-TV break replacement — your own ambient
            inventory.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-on-accent shadow-glow transition hover:brightness-110"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M8 21h8" />
              </svg>
              Advertisers
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/50 bg-surface/80 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur-sm transition hover:border-accent hover:bg-accent-dim"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
              </svg>
              Hosts
            </Link>
            <Link
              href="/login"
              className="px-2 text-sm text-muted underline-offset-4 transition hover:text-foreground hover:underline"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="relative px-2 sm:px-6 lg:px-0">
          <VenueScreenMocks />
        </div>
      </div>
    </section>
  );
}
