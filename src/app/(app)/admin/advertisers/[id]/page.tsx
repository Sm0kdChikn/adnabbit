import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { TakeDownPanel, TakeDownBadge } from "@/components/TakeDownPanel";
import { PageHeader } from "@/components/ui";

export default async function AdminAdvertiserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "HOST") redirect("/host");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const advertiser = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      profile: {
        select: { slug: true, displayName: true, published: true },
      },
      creatives: {
        orderBy: { updatedAt: "desc" },
        take: 50,
      },
    },
  });
  if (!advertiser || advertiser.role !== "ADVERTISER") notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/advertisers"
          className="text-sm text-accent hover:underline"
        >
          ← Advertisers
        </Link>
        <PageHeader
          title={advertiser.name || advertiser.email}
          description={advertiser.email}
          className="mt-2"
          actions={
            <TakeDownBadge
              takenDownAt={advertiser.advertiserTakenDownAt}
              reason={advertiser.advertiserTakenDownReason}
              label="Advertiser taken down"
            />
          }
        />
        {advertiser.profile?.slug && (
          <p className="text-sm text-muted">
            Profile{" "}
            <Link
              href={`/a/${advertiser.profile.slug}`}
              className="text-accent hover:underline"
            >
              /a/{advertiser.profile.slug}
            </Link>
            {advertiser.profile.published ? "" : " (draft)"}
          </p>
        )}
      </div>

      <TakeDownPanel
        target="advertiser"
        id={advertiser.id}
        takenDownAt={advertiser.advertiserTakenDownAt}
        reason={advertiser.advertiserTakenDownReason}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Creatives ({advertiser.creatives.length})
        </h2>
        {advertiser.creatives.length === 0 ? (
          <p className="text-sm text-muted">No creatives yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {advertiser.creatives.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{c.name}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-muted">
                    {c.fileName} · {c.mimeType}
                  </p>
                  <a
                    href={`/api/uploads/${c.storedName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-sm text-accent hover:underline"
                  >
                    Preview
                  </a>
                </div>
                {c.status === "APPROVED" && (
                  <div className="w-full max-w-xs shrink-0">
                    <TakeDownPanel
                      target="creative"
                      id={c.id}
                      takenDownAt={c.takenDownAt}
                      reason={c.takenDownReason}
                      compact
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
