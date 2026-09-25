import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "ADMIN") redirect("/admin");
  if (session?.user?.role === "HOST") redirect("/host");
  if (session?.user?.role === "ADVERTISER") redirect("/dashboard");

  return (
    <div className="space-y-8 py-12 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">AdNabbit Creative Portal</h1>
      <p className="mx-auto max-w-xl text-lg text-slate-600">
        Upload ad creatives, submit them for review, and track approval status. Admins approve or
        reject pending submissions.
      </p>
      <div className="flex justify-center gap-4">
        <Link
          href="/signup"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700"
        >
          Advertiser sign up
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-800 hover:bg-slate-50"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
