const venues = [
  {
    title: "Gyms & fitness",
    body: "Ambient screens between sets — not competing with the class monitor.",
  },
  {
    title: "Waiting rooms",
    body: "Clinics, salons, and lobbies where dwell time is the medium.",
  },
  {
    title: "Retail floors",
    body: "Endcaps and checkout displays that stay on-brand for the store.",
  },
  {
    title: "Sports bars (second screens)",
    body: "Dedicated displays beside the game — your inventory, not a live-break slot.",
  },
];

export function SocialProof() {
  return (
    <section className="border-b border-border py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Built for local advertisers & venue hosts
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Screens that match the room
          </h2>
          <p className="mt-3 text-muted">
            Qualitative fit over vanity metrics — AdNabbit is for dedicated
            venue inventory, not invented brand logos or fake ROAS.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {venues.map((v) => (
            <div
              key={v.title}
              className="rounded-xl border border-border bg-surface p-5 transition hover:border-accent/30"
            >
              <div
                className="mb-3 h-8 w-8 rounded-lg bg-accent-dim ring-1 ring-accent/25"
                aria-hidden
              >
                <div className="flex h-full items-center justify-center">
                  <span className="h-2 w-2 rounded-sm bg-accent" />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-foreground">{v.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{v.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
