import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

/** Returns session user + owned Host if HOST role with a linked venue; else 401/403/404. */
export async function requireHostApi() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "HOST") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const host = await prisma.host.findUnique({
    where: { userId: session.user.id },
  });
  if (!host) {
    return {
      error: NextResponse.json(
        { error: "No venue linked to this account" },
        { status: 404 }
      ),
    };
  }
  return { user: session.user, host };
}

/** Page helper: session user must be HOST with linked Host. */
export async function requireHostPage() {
  const session = await getServerSession(authOptions);
  return { session, hostUserId: session?.user?.id };
}
