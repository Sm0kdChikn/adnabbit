import { prisma } from "@/lib/prisma";
import { ADVERTISER_CATEGORY_LABELS, type AdvertiserCategory } from "@/lib/types";
import Link from "next/link";
import type { Metadata } from "next";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await prisma.advertiserProfile.findUnique({
    where: { slug: params.slug },
  });
  if (!profile?.published) {
    return { title: "Profile not available — AdNabbit" };
  }
  return {
    title: `${profile.displayName} — AdNabbit`,
    description: profile.pitch || undefined,
  };
}

function categoryLabel(category: string | null) {
  if (!category) return null;
  return (
    ADVERTISER_CATEGORY_LABELS[category as AdvertiserCategory] || category
  );
}

function parseZips(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((z) => z.trim())
    .filter(Boolean);
}

export default async function PublicAdvertiserPage({ params }: Props) {
  const profile = await prisma.advertiserProfile.findUnique({
    where: { slug: params.slug },
  });

  if (!profile || !profile.published) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-foreground">Profile not available</h1>
        <p className="text-muted">
          This advertiser profile is unpublished or does not exist.
        </p>
        <Link href="/" className="inline-block text-sm text-accent hover:underline">
          ← Back to AdNabbit
        </Link>
      </div>
    );
  }

  const logoSrc = profile.logoStoredName
    ? `/api/uploads/${profile.logoStoredName}`
    : profile.logoUrl || null;
  const zips = parseZips(profile.serviceAreaZips);
  const cat = categoryLabel(profile.category);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="flex flex-wrap items-start gap-6">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={`${profile.displayName} logo`}
              className="h-24 w-24 rounded-xl border border-border object-contain bg-background-elevated"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-accent-dim text-2xl font-bold text-accent">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{profile.displayName}</h1>
            {cat && (
              <span className="inline-flex rounded-full bg-accent-dim px-2.5 py-0.5 text-xs font-semibold text-accent">
                {cat}
              </span>
            )}
            {profile.pitch && (
              <p className="text-muted leading-relaxed">{profile.pitch}</p>
            )}
          </div>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          {profile.website && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                Website
              </dt>
              <dd>
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline break-all"
                >
                  {profile.website.replace(/^https?:\/\//i, "")}
                </a>
              </dd>
            </div>
          )}
          {profile.contact && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                Contact
              </dt>
              <dd className="text-foreground">
                {profile.contact.includes("@") ? (
                  <a href={`mailto:${profile.contact}`} className="text-accent hover:underline">
                    {profile.contact}
                  </a>
                ) : (
                  <a href={`tel:${profile.contact}`} className="text-accent hover:underline">
                    {profile.contact}
                  </a>
                )}
              </dd>
            </div>
          )}
          {zips.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                Service area
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {zips.map((z) => (
                  <span
                    key={z}
                    className="rounded-md bg-surface-hover px-2 py-0.5 text-sm text-muted"
                  >
                    {z}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <p className="text-center text-xs text-muted-strong">
        Shareable profile · /a/{profile.slug}
      </p>
    </div>
  );
}
