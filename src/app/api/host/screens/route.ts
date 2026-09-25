import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHostApi } from "@/lib/host";
import { isInventoryStatus } from "@/lib/types";

export async function GET() {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const screens = await prisma.screen.findMany({
    where: { hostId: auth.host.id },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ screens });
}

export async function POST(req: Request) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  let body: {
    name?: string;
    city?: string;
    zip?: string;
    inventoryStatus?: string;
    notes?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const city = (body.city || "").trim();
  const zip = (body.zip || "").trim();
  const inventoryStatus = (body.inventoryStatus || "OPEN").trim();
  const notes = body.notes?.trim() || null;

  if (!name || !city || !zip) {
    return NextResponse.json(
      { error: "name, city, and zip are required" },
      { status: 400 }
    );
  }
  if (!isInventoryStatus(inventoryStatus)) {
    return NextResponse.json({ error: "Invalid inventoryStatus" }, { status: 400 });
  }

  const screen = await prisma.screen.create({
    data: {
      name,
      city,
      zip,
      inventoryStatus,
      notes,
      hostId: auth.host.id,
    },
  });

  return NextResponse.json({ screen }, { status: 201 });
}
