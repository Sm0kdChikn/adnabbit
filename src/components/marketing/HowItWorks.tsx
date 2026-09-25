const steps = [
  {
    n: "01",
    title: "Upload creatives",
    body: "Advertisers upload assets into the portal. Formats and metadata stay tied to each campaign.",
  },
  {
    n: "02",
    title: "Review & approve",
    body: "Admins (and hosts, where required) approve or reject submissions before anything reaches a screen.",
  },
  {
    n: "03",
    title: "Schedule on screens",
    body: "Place approved creatives onto dedicated venue screens — lobbies, gyms, retail, bar TVs used as second screens.",
  },
  {
    n: "04",
    title: "Proof of play",
    body: "Export play logs and reports so everyone can see what actually ran, where, and when.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative overflow-hidden border-b border-border py-16 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 marketing-hero-dots opacity-20"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-muted">
            From creative to screen to report — a short loop built for dedicated
            DOOH inventory.
          </p>
        </div>
        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li
              key={step.n}
              className="relative overflow-hidden rounded-2xl border border-border bg-background-elevated/70 p-6 backdrop-blur-sm"
            >
              <span
                className="pointer-events-none absolute -right-1 -top-4 select-none font-sans text-7xl font-bold leading-none text-accent/[0.12]"
                aria-hidden
              >
                {step.n}
              </span>
              <span className="relative font-mono text-xs font-semibold tracking-widest text-accent">
                STEP {step.n}
              </span>
              <h3 className="relative mt-4 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
