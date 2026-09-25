import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";

type Ctx = { params: { id: string } };

/**
 * Attach (or create+attach) a HOST user to this Host.
 * Body: { email, password?, name? }
 * - If user missing: password required; creates HOST user and links.
 * - If user exists with HOST role and no other host: link (optional password update).
 * - Wrong role / already linked elsewhere → 409.
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const host = await prisma.host.findUnique({ where: { id: params.id } });
  if (!host) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { email?: string; password?: string; name?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").toLowerCase().trim();
  const password = body.password || "";
  const name = body.name?.trim() || null;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "password (min 8 chars) required to create HOST user" },
        { status: 400 }
      );
    }
    const passwordHash = await bcrypt.hash(password, 12);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || email.split("@")[0],
        role: "HOST",
      },
    });
  } else {
    if (user.role !== "HOST") {
      return NextResponse.json(
        { error: `User exists with role ${user.role}; must be HOST` },
        { status: 409 }
      );
    }
    const other = await prisma.host.findFirst({
      where: { userId: user.id, NOT: { id: host.id } },
    });
    if (other) {
      return NextResponse.json(
        { error: "User already owns another host" },
        { status: 409 }
      );
    }
    if (password && password.length >= 8) {
      const passwordHash = await bcrypt.hash(password, 12);
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          ...(name !== null ? { name } : {}),
        },
      });
    } else if (name !== null) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name },
      });
    }
  }

  // Detach previous owner if any, then attach
  if (host.userId && host.userId !== user.id) {
    // just overwrite; previous user keeps HOST role but unlinked
  }

  const updated = await prisma.host.update({
    where: { id: host.id },
    data: { userId: user.id },
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ host: updated, user: updated.user });
}
