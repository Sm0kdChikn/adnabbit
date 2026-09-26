/**
 * Ticket T — resolve analytics scope from session role.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import {
  type AnalyticsRole,
  type AnalyticsScope,
} from "./analytics";
import { prisma } from "./prisma";

export async function requireAnalyticsScope(): Promise<
  | { scope: AnalyticsScope; error?: undefined }
  | { scope?: undefined; error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const role = session.user.role as AnalyticsRole;
  if (role !== "ADMIN" && role !== "HOST" && role !== "ADVERTISER") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (role === "ADMIN") {
    return {
      scope: { role, userId: session.user.id },
    };
  }

  if (role === "HOST") {
    const host = await prisma.host.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!host) {
      return {
        error: NextResponse.json(
          { error: "No venue linked to this account" },
          { status: 404 }
        ),
      };
    }
    return {
      scope: { role, userId: session.user.id, hostId: host.id },
    };
  }

  // ADVERTISER
  return {
    scope: {
      role,
      userId: session.user.id,
      advertiserId: session.user.id,
    },
  };
}

/** API base path for CSV export by role. */
export function analyticsApiBase(role: AnalyticsRole): string {
  if (role === "ADMIN") return "/api/admin/analytics";
  if (role === "HOST") return "/api/host/analytics";
  return "/api/analytics";
}

/** Page path by role. */
export function analyticsPagePath(role: AnalyticsRole): string {
  if (role === "ADMIN") return "/admin/analytics";
  if (role === "HOST") return "/host/analytics";
  return "/analytics";
}
