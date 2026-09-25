"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function Nav() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-indigo-700">
          AdNabbit
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          {session?.user ? (
            <>
              {role === "ADVERTISER" && (
                <>
                  <Link href="/dashboard" className="text-slate-700 hover:text-indigo-600">
                    Dashboard
                  </Link>
                  <Link href="/screens" className="text-slate-700 hover:text-indigo-600">
                    Screens
                  </Link>
                  <Link href="/placements" className="text-slate-700 hover:text-indigo-600">
                    Placements
                  </Link>
                  <Link href="/schedules" className="text-slate-700 hover:text-indigo-600">
                    Schedules
                  </Link>
                  <Link href="/schedules/calendar" className="text-slate-700 hover:text-indigo-600">
                    Calendar
                  </Link>
                  <Link href="/profile" className="text-slate-700 hover:text-indigo-600">
                    Profile
                  </Link>
                  <Link href="/reports" className="text-slate-700 hover:text-indigo-600">
                    Reports
                  </Link>
                  <Link href="/creatives/new" className="text-slate-700 hover:text-indigo-600">
                    Upload
                  </Link>
                </>
              )}
              {role === "ADMIN" && (
                <>
                  <Link href="/admin" className="text-slate-700 hover:text-indigo-600">
                    Review
                  </Link>
                  <Link href="/admin/placements" className="text-slate-700 hover:text-indigo-600">
                    Placements
                  </Link>
                  <Link href="/admin/schedules" className="text-slate-700 hover:text-indigo-600">
                    Schedules
                  </Link>
                  <Link href="/admin/schedules/calendar" className="text-slate-700 hover:text-indigo-600">
                    Calendar
                  </Link>
                  <Link href="/admin/hosts" className="text-slate-700 hover:text-indigo-600">
                    Hosts
                  </Link>
                  <Link href="/admin/screens" className="text-slate-700 hover:text-indigo-600">
                    Screens
                  </Link>
                  <Link href="/admin/profiles" className="text-slate-700 hover:text-indigo-600">
                    Profiles
                  </Link>
                  <Link href="/admin/proof-of-play" className="text-slate-700 hover:text-indigo-600">
                    PoP
                  </Link>
                </>
              )}
              <span className="text-slate-500">
                {session.user.email} · {role}
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-slate-800 hover:bg-slate-200"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-700 hover:text-indigo-600">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
