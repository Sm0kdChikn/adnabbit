import { prisma } from "./prisma";
import type { AdminFolderScope } from "./types";

/** Validate that targetId exists for the given target type. */
export async function validateFolderTarget(
  targetType: AdminFolderScope,
  targetId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (targetType === "HOST") {
    const host = await prisma.host.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!host) return { ok: false, error: "Host not found" };
    return { ok: true };
  }
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "ADVERTISER") {
    return { ok: false, error: "Advertiser user not found" };
  }
  return { ok: true };
}

/** Remove folder membership when a Host is deleted. */
export async function cleanupHostFolderItem(hostId: string) {
  await prisma.adminFolderItem.deleteMany({
    where: { targetType: "HOST", targetId: hostId },
  });
}

/** Remove folder membership when an Advertiser User is deleted (if such a path exists). */
export async function cleanupAdvertiserFolderItem(userId: string) {
  await prisma.adminFolderItem.deleteMany({
    where: { targetType: "ADVERTISER", targetId: userId },
  });
}
