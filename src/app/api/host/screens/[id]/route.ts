import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHostApi } from "@/lib/host";
import { isInventoryStatus } from "@/lib/types";

type Ctx = { params: { id: string } };

async function ownScreen(hostId: string, screenId: string) {
  return prisma.screen.findFirst({
    where: { id: screenId, hostId },
  });
}

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const screen = await prisma.screen.findFirst({
    where: { id: params.id, hostId: auth.host.id },
    include: {
      placementRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          creative: { select: { id: true, name: true, status: true } },
          advertiser: { select: { id: true, email: true, name: true } },
        },
      },
      schedules: {
        orderBy: { createdAt: "desc" },
        include: {
          placement: {
            include: {
              creative: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!screen) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ screen });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const existing = await ownScreen(auth.host.id, params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const name = body.name !== undefined ? body.name.trim() : existing.name;
  const city = body.city !== undefined ? body.city.trim() : existing.city;
  const zip = body.zip !== undefined ? body.zip.trim() : existing.zip;
  const inventoryStatus =
    body.inventoryStatus !== undefined
      ? body.inventoryStatus.trim()
      : existing.inventoryStatus;
  const notes =
    body.notes !== undefined ? body.notes?.trim() || null : existing.notes;

  if (!name || !city || !zip) {
    return NextResponse.json(
      { error: "name, city, and zip are required" },
      { status: 400 }
    );
  }
  if (!isInventoryStatus(inventoryStatus)) {
    return NextResponse.json({ error: "Invalid inventoryStatus" }, { status: 400 });
  }

  const screen = await prisma.screen.update({
    where: { id: existing.id },
    data: { name, city, zip, inventoryStatus, notes },
  });

  return NextResponse.json({ screen });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireHostApi();
  if (auth.error) return auth.error;

  const existing = await ownScreen(auth.host.id, params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.screen.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
