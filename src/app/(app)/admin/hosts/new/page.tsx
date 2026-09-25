import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HostForm } from "../HostForm";

export default async function NewHostPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/hosts" className="text-sm text-indigo-600 hover:underline">
          ← Hosts
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">New host</h1>
      </div>
      <HostForm mode="create" />
    </div>
  );
}
