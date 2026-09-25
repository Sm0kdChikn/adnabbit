import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { HostVenueForm } from "../HostVenueForm";

export default async function HostEditPage() {
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
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Edit venue</h1>
        <p className="text-sm text-slate-600">
          Update name, vertical, timezone, and notes for your venue.
        </p>
      </div>
      <HostVenueForm
        initial={{
          name: host.name,
          vertical: host.vertical,
          otherLabel: host.otherLabel,
          notes: host.notes,
          timezone: host.timezone,
        }}
      />
    </div>
  );
}
