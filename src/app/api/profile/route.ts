import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueSlugFromName } from "@/lib/slug";
import { isAdvertiserCategory } from "@/lib/types";
import {
  MAX_BYTES,
  ensureUploadDir,
  makeStoredName,
  absoluteUploadPath,
} from "@/lib/uploads";
import { writeFile } from "fs/promises";

const LOGO_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

async function requireAdvertiser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADVERTISER") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user: session.user };
}

export async function GET() {
  const auth = await requireAdvertiser();
  if (auth.error) return auth.error;

  const profile = await prisma.advertiserProfile.findUnique({
    where: { userId: auth.user!.id },
  });
  return NextResponse.json({ profile });
}

type ProfileFields = {
  displayName: string;
  pitch: string | null;
  website: string | null;
  contact: string | null;
  logoUrl: string | null;
  category: string | null;
  serviceAreaZips: string | null;
  published: boolean;
  clearLogo?: boolean;
};

function parseBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "true" || s === "1" || s === "on") return true;
    if (s === "false" || s === "0" || s === "off") return false;
  }
  return fallback;
}

function validateFields(raw: Partial<ProfileFields>): { error?: string; data?: ProfileFields } {
  const displayName = (raw.displayName || "").trim();
  if (!displayName) return { error: "Business name (displayName) is required" };

  const category = raw.category?.trim() || null;
  if (category && !isAdvertiserCategory(category)) {
    return { error: "Invalid category" };
  }

  let website = raw.website?.trim() || null;
  if (website && !/^https?:\/\//i.test(website)) {
    website = `https://${website}`;
  }

  const logoUrl = raw.logoUrl?.trim() || null;
  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
    return { error: "logoUrl must be an http(s) URL" };
  }

  return {
    data: {
      displayName,
      pitch: raw.pitch?.trim() || null,
      website,
      contact: raw.contact?.trim() || null,
      logoUrl,
      category,
      serviceAreaZips: raw.serviceAreaZips?.trim() || null,
      published: parseBool(raw.published, false),
      clearLogo: !!raw.clearLogo,
    },
  };
}

export async function PUT(req: Request) {
  const auth = await requireAdvertiser();
  if (auth.error) return auth.error;
  const userId = auth.user!.id;

  try {
    const contentType = req.headers.get("content-type") || "";
    let fields: Partial<ProfileFields> = {};
    let logoFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      fields = {
        displayName: String(form.get("displayName") || ""),
        pitch: form.get("pitch") != null ? String(form.get("pitch")) : null,
        website: form.get("website") != null ? String(form.get("website")) : null,
        contact: form.get("contact") != null ? String(form.get("contact")) : null,
        logoUrl: form.get("logoUrl") != null ? String(form.get("logoUrl")) : null,
        category: form.get("category") != null ? String(form.get("category")) : null,
        serviceAreaZips:
          form.get("serviceAreaZips") != null ? String(form.get("serviceAreaZips")) : null,
        published: parseBool(form.get("published"), false),
        clearLogo: parseBool(form.get("clearLogo"), false),
      };
      const f = form.get("logo");
      if (f instanceof File && f.size > 0) logoFile = f;
    } else {
      fields = await req.json();
    }

    const validated = validateFields(fields);
    if (validated.error || !validated.data) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const data = validated.data;

    let logoStoredName: string | null | undefined = undefined;
    if (logoFile) {
      if (!LOGO_MIME[logoFile.type]) {
        return NextResponse.json(
          { error: "Logo must be jpeg, png, or webp" },
          { status: 400 }
        );
      }
      if (logoFile.size > MAX_BYTES) {
        return NextResponse.json({ error: "Logo too large (max 50MB)" }, { status: 400 });
      }
      await ensureUploadDir();
      const storedName = makeStoredName(logoFile.type);
      // Prefer image extension from LOGO_MIME via ALLOWED_MIME (same keys)
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      await writeFile(absoluteUploadPath(storedName), buffer);
      logoStoredName = storedName;
      // Prefer uploaded file over external URL
      data.logoUrl = null;
    } else if (data.clearLogo) {
      logoStoredName = null;
    }

    const slug = await uniqueSlugFromName(data.displayName, userId);

    const existing = await prisma.advertiserProfile.findUnique({ where: { userId } });

    const profile = existing
      ? await prisma.advertiserProfile.update({
          where: { userId },
          data: {
            slug,
            displayName: data.displayName,
            pitch: data.pitch,
            website: data.website,
            contact: data.contact,
            logoUrl: data.logoUrl,
            category: data.category,
            serviceAreaZips: data.serviceAreaZips,
            published: data.published,
            ...(logoStoredName !== undefined ? { logoStoredName } : {}),
          },
        })
      : await prisma.advertiserProfile.create({
          data: {
            userId,
            slug,
            displayName: data.displayName,
            pitch: data.pitch,
            website: data.website,
            contact: data.contact,
            logoUrl: data.logoUrl,
            category: data.category,
            serviceAreaZips: data.serviceAreaZips,
            published: data.published,
            logoStoredName: logoStoredName ?? null,
          },
        });

    return NextResponse.json({ profile }, { status: existing ? 200 : 201 });
  } catch (e) {
    console.error("profile save error", e);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
