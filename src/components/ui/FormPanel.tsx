import type { HTMLAttributes, ReactNode } from "react";

/** Shared panel chrome for hours / download / offline / maintenance / output (Ticket UP). */
export const formPanelClass =
  "space-y-4 rounded-xl border border-border bg-surface p-4 sm:p-5";

export const formPanelCompactClass =
  "space-y-3 rounded-lg border border-border bg-background/50 p-3";

export const formLabelClass = "mb-1 block text-sm font-medium text-muted";

export const formControlClass =
  "w-full rounded-md border border-border bg-background-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50";

export const formHintClass = "mt-1 text-xs text-muted";

export function FormPanel({
  className = "",
  compact = false,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { compact?: boolean }) {
  return (
    <section
      className={`${compact ? formPanelCompactClass : formPanelClass} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

export function FormPanelHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {badge}
    </div>
  );
}

/** Consistent save error / success copy under control panels. */
export function FormFeedback({
  error,
  ok,
}: {
  error?: string | null;
  ok?: string | null;
}) {
  return (
    <>
      {error ? (
        <p className="text-sm text-[var(--status-danger-fg)]">{error}</p>
      ) : null}
      {ok ? (
        <p className="text-sm text-[var(--status-success-fg)]">{ok}</p>
      ) : null}
    </>
  );
}
