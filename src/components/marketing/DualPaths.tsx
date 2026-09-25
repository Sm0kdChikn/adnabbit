import Link from "next/link";

const advertiserBenefits = [
  "Upload creatives and track review status",
  "Request placements on published venue screens",
  "Schedule runs and export proof-of-play",
  "One portal for local & multi-location campaigns",
];

const hostBenefits = [
  "Publish your venue profile and screens",
  "Claim devices and keep inventory online",
  "Approve which ads run in your spaces",
  "Ambient screens — gyms, lobbies, bars & more",
];

function PathCard({
  eyebrow,
  title,
  description,
  benefits,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  benefits: string[];
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/90 p-6 shadow-card backdrop-blur-sm transition hover:border-accent/50 hover:shadow-glow-sm sm:p-8">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/10 opacity-0 blur-2xl transition group-hover:opacity-100"
        aria-hidden
      />
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {benefits.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm text-foreground/90">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-glow-sm"
              aria-hidden
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={primaryHref}
          className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-glow-sm transition hover:brightness-110"
        >
          {primaryLabel}
        </Link>
        <Link
          href={secondaryHref}
          className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/40 hover:bg-surface-hover"
        >
          {secondaryLabel}
        </Link>
      </div>
    </div>
  );
}

export function DualPaths() {
  return (
    <section className="border-b border-border py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Two paths. One control plane.
          </h2>
          <p className="mt-3 text-muted">
            Whether you buy dedicated screen time or run the venue, AdNabbit
            keeps creatives, approvals, and schedules in one place.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <PathCard
            eyebrow="Advertisers"
            title="Put your brand on dedicated screens"
            description="Reach people where they already spend time — on ambient and second screens owned by the venue, not hijacked from live TV."
            benefits={advertiserBenefits}
            primaryHref="/signup"
            primaryLabel="Get started"
            secondaryHref="/login"
            secondaryLabel="Log in"
          />
          <PathCard
            eyebrow="Hosts"
            title="Monetize your venue screens"
            description="List screens, claim playback devices, and decide what runs in your gym, waiting room, retail floor, or sports-bar dedicated display."
            benefits={hostBenefits}
            primaryHref="/signup"
            primaryLabel="Get started"
            secondaryHref="/login"
            secondaryLabel="Log in"
          />
        </div>
      </div>
    </section>
  );
}
