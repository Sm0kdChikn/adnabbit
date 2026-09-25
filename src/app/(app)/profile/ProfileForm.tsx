"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ADVERTISER_CATEGORIES,
  ADVERTISER_CATEGORY_LABELS,
  type AdvertiserCategory,
} from "@/lib/types";
import Link from "next/link";

export type ProfileInitial = {
  slug: string;
  displayName: string;
  pitch: string | null;
  website: string | null;
  contact: string | null;
  logoStoredName: string | null;
  logoUrl: string | null;
  category: string | null;
  serviceAreaZips: string | null;
  published: boolean;
} | null;

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial?.displayName || "");
  const [pitch, setPitch] = useState(initial?.pitch || "");
  const [website, setWebsite] = useState(initial?.website || "");
  const [contact, setContact] = useState(initial?.contact || "");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl || "");
  const [category, setCategory] = useState<AdvertiserCategory | "">(
    (initial?.category as AdvertiserCategory) || ""
  );
  const [serviceAreaZips, setServiceAreaZips] = useState(
    initial?.serviceAreaZips || ""
  );
  const [published, setPublished] = useState(initial?.published ?? false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [clearLogo, setClearLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSlug, setSavedSlug] = useState(initial?.slug || "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.set("displayName", displayName);
      form.set("pitch", pitch);
      form.set("website", website);
      form.set("contact", contact);
      form.set("logoUrl", logoUrl);
      form.set("category", category);
      form.set("serviceAreaZips", serviceAreaZips);
      form.set("published", published ? "true" : "false");
      if (clearLogo) form.set("clearLogo", "true");
      if (logoFile) form.set("logo", logoFile);

      const res = await fetch("/api/profile", { method: "PUT", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setSavedSlug(data.profile.slug);
      setClearLogo(false);
      setLogoFile(null);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const hasUploadedLogo = initial?.logoStoredName && !clearLogo && !logoFile;

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-lg space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
    >
      {error && (
        <p className="rounded-md bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-fg)]">{error}</p>
      )}

      {savedSlug && published && (
        <p className="rounded-md bg-[var(--status-success-bg)] px-3 py-2 text-sm text-[var(--status-success-fg)]">
          Public URL:{" "}
          <Link href={`/a/${savedSlug}`} className="font-medium underline" target="_blank">
            /a/{savedSlug}
          </Link>
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">
          Business name
        </label>
        <input
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        <p className="mt-1 text-xs text-muted">
          Slug is derived from this name (collision-safe).
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">
          Short pitch
        </label>
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={3}
          placeholder="One or two sentences about your business"
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">
          Website URL
        </label>
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">
          Contact (phone or email)
        </label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="hello@example.com or (303) 555-0100"
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as AdvertiserCategory | "")}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        >
          <option value="">Select category…</option>
          {ADVERTISER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ADVERTISER_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">
          Service area / ZIPs
        </label>
        <input
          type="text"
          value={serviceAreaZips}
          onChange={(e) => setServiceAreaZips(e.target.value)}
          placeholder="80202, 80205, 80012"
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        <p className="mt-1 text-xs text-muted">Comma-separated ZIP codes or free-form area.</p>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-background-elevated p-3">
        <p className="text-sm font-medium text-muted">Logo (optional)</p>
        {hasUploadedLogo && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/uploads/${initial!.logoStoredName}`}
              alt="Current logo"
              className="h-12 w-12 rounded object-contain bg-surface border"
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={clearLogo}
                onChange={(e) => setClearLogo(e.target.checked)}
              />
              Remove uploaded logo
            </label>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-muted">Upload image</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              setLogoFile(e.target.files?.[0] || null);
              if (e.target.files?.[0]) setClearLogo(false);
            }}
            className="w-full text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Or logo URL</label>
          <input
            type="text"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://cdn.example.com/logo.png"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="h-4 w-4 rounded border-border text-accent"
        />
        Publish public profile
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:brightness-110 disabled:opacity-50"
      >
        {saving ? "Saving…" : initial ? "Save profile" : "Create profile"}
      </button>
    </form>
  );
}
