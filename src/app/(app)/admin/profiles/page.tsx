import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ADVERTISER_CATEGORY_LABELS, type AdvertiserCategory } from "@/lib/types";
import { UnpublishButton } from "./UnpublishButton";

export default async function AdminProfilesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const profiles = await prisma.advertiserProfile.findMany({
    orderBy: { updatedAt: "desc" },
    include: { user: { select: { email: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Advertiser profiles</h1>
        <p className="text-sm text-slate-600">
          View profiles and unpublish if needed. Admins cannot edit advertiser content.
        </p>
      </div>

      {profiles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No advertiser profiles yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{p.displayName}</span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      p.published
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.published ? "PUBLISHED" : "UNPUBLISHED"}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {p.user.email}
                  {p.category
                    ? ` · ${ADVERTISER_CATEGORY_LABELS[p.category as AdvertiserCategory] || p.category}`
                    : ""}
                  {" · "}
                  {p.published ? (
                    <Link
                      href={`/a/${p.slug}`}
                      className="text-indigo-600 hover:underline"
                      target="_blank"
                    >
                      /a/{p.slug}
                    </Link>
                  ) : (
                    <span className="text-slate-400">/a/{p.slug}</span>
                  )}
                </p>
              </div>
              {p.published && <UnpublishButton profileId={p.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
