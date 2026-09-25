import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-ambience relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_80%_at_50%_0%,var(--body-glow-1),transparent)]"
        aria-hidden
      />
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle labeled />
      </div>
      <div className="mb-8">
        <BrandLogo href="/" size="lg" />
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-center text-xs text-muted-strong">
        AdNabbit creative portal
      </p>
    </div>
  );
}
