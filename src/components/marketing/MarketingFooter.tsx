import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export function MarketingFooter() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border py-16 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--accent-dim),transparent_65%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to run dedicated venue screens?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Create an account to upload creatives, host screens, or administer
            the network. OptiSigns remains near-term production playback — this
            portal is the control plane.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-glow transition hover:brightness-110"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="inline-flex rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/40 hover:bg-surface-hover"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <BrandLogo size="sm" />
          <p className="text-xs text-muted-strong">
            © {new Date().getFullYear()} AdNabbit. Dedicated venue screens.
          </p>
          <div className="flex gap-4 text-xs text-muted">
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
