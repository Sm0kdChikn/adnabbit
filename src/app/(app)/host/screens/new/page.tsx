import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { HostScreenForm } from "../HostScreenForm";

export default async function HostNewScreenPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "HOST") redirect("/dashboard");

  const host = await prisma.host.findUnique({
    where: { userId: session.user.id },
  });
  if (!host) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/host" className="text-sm text-indigo-600 hover:underline">
          ← Host portal
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Add screen</h1>
        <p className="text-sm text-slate-600">
          New screen for {host.name}. Advertisers will see it when inventory is OPEN or
          LIMITED.
        </p>
      </div>
      <HostScreenForm mode="create" />
    </div>
  );
}
