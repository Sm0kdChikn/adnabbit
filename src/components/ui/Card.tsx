import { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Soft cyan border + glow on hover; keep light theme readable */
  glow?: boolean;
};

export function Card({
  className = "",
  children,
  glow = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`portal-card-glow rounded-xl border border-border bg-surface shadow-card transition ${
        glow
          ? "hover:border-accent/45 hover:shadow-glow-sm dark:hover:border-accent/50"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`border-b border-border px-4 py-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardBody({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode;
};

export function EmptyState({
  className = "",
  children,
  icon,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-dashed border-accent/35 bg-accent-dim/40 p-8 text-center text-muted dark:border-accent/40 dark:bg-accent-dim/25 ${className}`}
      {...props}
    >
      {icon ? (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-accent opacity-80">
          {icon}
        </div>
      ) : null}
      <div className="mx-auto max-w-md space-y-1 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}
