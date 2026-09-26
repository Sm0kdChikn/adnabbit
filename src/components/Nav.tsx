"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui";
import { FleetAlertNavBadge } from "@/components/admin/FleetAlertNavBadge";

type NavLink = { href: string; label: string };

function linksForRole(role?: string | null): NavLink[] {
  if (role === "ADVERTISER") {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/screens", label: "Screens" },
      { href: "/placements", label: "Placements" },
      { href: "/schedules", label: "Schedules" },
      { href: "/schedules/calendar", label: "Calendar" },
      { href: "/profile", label: "Profile" },
      { href: "/reports", label: "Reports" },
      { href: "/creatives/new", label: "Upload" },
    ];
  }
  if (role === "HOST") {
    return [
      { href: "/host", label: "My venue" },
      { href: "/host/screens/new", label: "Add screen" },
    ];
  }
  if (role === "ADMIN") {
    return [
      { href: "/admin", label: "Review" },
      { href: "/admin/placements", label: "Placements" },
      { href: "/admin/schedules", label: "Schedules" },
      { href: "/admin/schedules/calendar", label: "Calendar" },
      { href: "/admin/hosts", label: "Hosts" },
      { href: "/admin/advertisers", label: "Advertisers" },
      { href: "/admin/screens", label: "Screens" },
      { href: "/admin/fleet", label: "Fleet" },
      { href: "/admin/alerts", label: "Alerts" },
      { href: "/admin/profiles", label: "Profiles" },
      { href: "/admin/proof-of-play", label: "PoP" },
    ];
  }
  return [];
}

function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/dashboard" || href === "/host") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinkItem({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-sm transition ${
        active
          ? "bg-accent-dim text-accent shadow-glow-sm"
          : "text-muted hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export function Nav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = session?.user?.role;
  const links = linksForRole(role);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`portal-nav sticky top-0 z-40 border-b border-border/80 bg-background-elevated/85 backdrop-blur-xl transition-shadow ${
        scrolled ? "shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.45)]" : ""
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <BrandLogo size="sm" />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {session?.user ? (
            <>
              {links.map((l) => (
                <span key={l.href} className="inline-flex items-center">
                  <NavLinkItem
                    href={l.href}
                    label={l.label}
                    active={isActive(pathname, l.href)}
                  />
                  {role === "ADMIN" && l.href === "/admin/alerts" ? (
                    <FleetAlertNavBadge />
                  ) : null}
                </span>
              ))}
              <span className="ml-2 max-w-[11rem] truncate text-xs text-muted-strong" title={session.user.email || ""}>
                {session.user.email}
              </span>
              <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                {role}
              </span>
              <ThemeToggle className="ml-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="ml-1"
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
        </nav>

        {/* Mobile: theme + menu */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-border p-2 text-muted hover:bg-surface-hover hover:text-foreground"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="border-t border-border bg-background-elevated px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {session?.user ? (
              <>
                {links.map((l) => (
                  <NavLinkItem
                    key={l.href}
                    href={l.href}
                    label={l.label}
                    active={isActive(pathname, l.href)}
                    onClick={() => setOpen(false)}
                  />
                ))}
                <div className="mt-2 border-t border-border pt-2">
                  <p className="truncate px-2.5 text-xs text-muted-strong">{session.user.email}</p>
                  <p className="px-2.5 text-[10px] uppercase tracking-wide text-muted">{role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 justify-start"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2.5 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-accent px-2.5 py-2 text-center text-sm font-semibold text-on-accent"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
