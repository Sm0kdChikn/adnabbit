import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandLogo size="sm" />
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-md px-2.5 py-1.5 text-sm text-muted transition hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent shadow-glow-sm transition hover:brightness-110"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
