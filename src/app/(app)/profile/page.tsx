import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./ProfileForm";
import Link from "next/link";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.role === "HOST") redirect("/host");

  if (session.user.role !== "ADVERTISER") redirect("/dashboard");

  const profile = await prisma.advertiserProfile.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Public profile</h1>
        <p className="text-sm text-slate-600">
          Create a shareable page at <code className="text-xs">/a/your-slug</code>. Only
          published profiles are visible to the public.
        </p>
      </div>
      <ProfileForm
        initial={
          profile
            ? {
                slug: profile.slug,
                displayName: profile.displayName,
                pitch: profile.pitch,
                website: profile.website,
                contact: profile.contact,
                logoStoredName: profile.logoStoredName,
                logoUrl: profile.logoUrl,
                category: profile.category,
                serviceAreaZips: profile.serviceAreaZips,
                published: profile.published,
              }
            : null
        }
      />
    </div>
  );
}
