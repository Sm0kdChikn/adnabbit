import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ADVERTISER_CATEGORY_LABELS, type AdvertiserCategory } from "@/lib/types";
import { UnpublishButton } from "./UnpublishButton";
import { PageHeader } from "@/components/ui";

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
      <PageHeader
        title="Advertiser profiles"
        description="View profiles and unpublish if needed. Admins cannot edit advertiser content."
      />

      {profiles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          No advertiser profiles yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface shadow-sm">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{p.displayName}</span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      p.published
                        ? "bg-[var(--status-success-bg)] text-[var(--status-success-fg)]"
                        : "bg-surface-hover text-muted"
                    }`}
                  >
                    {p.published ? "PUBLISHED" : "UNPUBLISHED"}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {p.user.email}
                  {p.category
                    ? ` · ${ADVERTISER_CATEGORY_LABELS[p.category as AdvertiserCategory] || p.category}`
                    : ""}
                  {" · "}
                  {p.published ? (
                    <Link
                      href={`/a/${p.slug}`}
                      className="text-accent hover:underline"
                      target="_blank"
                    >
                      /a/{p.slug}
                    </Link>
                  ) : (
                    <span className="text-muted-strong">/a/{p.slug}</span>
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
