import { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 ${className}`}
    >
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function SectionTitle({
  children,
  className = "",
  as: Tag = "h2",
}: {
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <Tag
      className={`relative inline-flex items-baseline gap-2 text-lg font-semibold text-foreground ${className}`}
    >
      <span
        className="absolute -bottom-1 left-0 h-0.5 w-8 rounded-full bg-accent/70 shadow-glow-sm"
        aria-hidden
      />
      <span className="pb-1.5">{children}</span>
    </Tag>
  );
}

export function StatPill({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface/80 px-4 py-3 shadow-card backdrop-blur-sm ${className}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-strong">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

export function StatRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {children}
    </div>
  );
}
