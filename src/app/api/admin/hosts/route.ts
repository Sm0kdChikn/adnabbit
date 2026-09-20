import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { isHostVertical } from "@/lib/types";
import { isValidTimeZone } from "@/lib/schedules";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const hosts = await prisma.host.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { screens: true } } },
  });
  return NextResponse.json({ hosts });
}

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: {
    name?: string;
    vertical?: string;
    otherLabel?: string | null;
    notes?: string | null;
    timezone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const vertical = (body.vertical || "").trim();
  const otherLabel = body.otherLabel?.trim() || null;
  const notes = body.notes?.trim() || null;
  const timezone = (body.timezone || "America/Denver").trim() || "America/Denver";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!isHostVertical(vertical)) {
    return NextResponse.json({ error: "Invalid vertical" }, { status: 400 });
  }
  if (vertical === "OTHER" && !otherLabel) {
    return NextResponse.json(
      { error: "otherLabel is required when vertical is OTHER" },
      { status: 400 }
    );
  }
  if (vertical !== "OTHER" && otherLabel) {
    return NextResponse.json(
      { error: "otherLabel is only allowed when vertical is OTHER" },
      { status: 400 }
    );
  }

  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "Invalid IANA timezone" }, { status: 400 });
  }

  const host = await prisma.host.create({
    data: {
      name,
      vertical,
      otherLabel: vertical === "OTHER" ? otherLabel : null,
      notes,
      timezone,
    },
  });

  return NextResponse.json({ host }, { status: 201 });
}
