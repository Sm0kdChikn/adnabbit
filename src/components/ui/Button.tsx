import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent font-semibold shadow-glow-sm hover:brightness-110 disabled:opacity-60",
  secondary:
    "bg-accent-dim text-accent border border-border hover:border-accent/40 hover:bg-accent/15",
  ghost:
    "bg-transparent text-muted hover:text-foreground hover:bg-surface-hover",
  danger:
    "bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-60",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60",
  warning:
    "bg-amber-500 text-on-accent font-semibold hover:bg-amber-400 disabled:opacity-60",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-4 py-2 text-sm rounded-md",
  lg: "px-5 py-2.5 text-base rounded-lg",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className = "", variant = "primary", size = "md", type = "button", ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex items-center justify-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
