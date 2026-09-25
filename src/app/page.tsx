import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "ADMIN") redirect("/admin");
  if (session?.user?.role === "HOST") redirect("/host");
  if (session?.user?.role === "ADVERTISER") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-background-elevated/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <BrandLogo size="sm" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent shadow-glow-sm hover:brightness-110"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-1 flex-col items-center justify-center space-y-8 px-4 py-16 text-center">
        <BrandLogo href="" size="lg" showWordmark={false} />
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          AdNabbit Creative Portal
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted">
          Upload ad creatives, submit them for review, and track approval status. Admins
          approve or reject pending submissions.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-on-accent shadow-glow hover:brightness-110"
          >
            Advertiser sign up
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border bg-surface px-5 py-2.5 font-medium text-foreground hover:border-accent/40 hover:bg-surface-hover"
          >
            Log in
          </Link>
        </div>
      </main>
    </div>
  );
}
