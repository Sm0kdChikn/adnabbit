/**
 * Ticket Z — admin DeviceGroup helpers.
 * Flat groups of paired devices only. Soft miss: nested / host-owned.
 * Out: auto-geo, new roles, OptiSigns.
 */
import { prisma } from "./prisma";

export type DeviceGroupListItem = {
  id: string;
  name: string;
  note: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DeviceGroupMemberDto = {
  id: string;
  deviceId: string;
  screenId: string;
  screenName: string;
  hostId: string;
  hostName: string;
  city: string;
  zip: string;
  deviceName: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

export type DeviceGroupDetail = DeviceGroupListItem & {
  members: DeviceGroupMemberDto[];
};

export async function listDeviceGroups(): Promise<DeviceGroupListItem[]> {
  const rows = await prisma.deviceGroup.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    include: { _count: { select: { members: true } } },
  });
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    note: g.note,
    memberCount: g._count.members,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }));
}

export async function getDeviceGroupDetail(
  groupId: string
): Promise<DeviceGroupDetail | null> {
  const g = await prisma.deviceGroup.findUnique({
    where: { id: groupId },
    include: {
      _count: { select: { members: true } },
      members: {
        orderBy: { createdAt: "asc" },
        include: {
          device: {
            select: {
              id: true,
              name: true,
              lastSeenAt: true,
              screen: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                  zip: true,
                  host: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!g) return null;
  return {
    id: g.id,
    name: g.name,
    note: g.note,
    memberCount: g._count.members,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    members: g.members.map((m) => ({
      id: m.id,
      deviceId: m.deviceId,
      screenId: m.device.screen.id,
      screenName: m.device.screen.name,
      hostId: m.device.screen.host.id,
      hostName: m.device.screen.host.name,
      city: m.device.screen.city,
      zip: m.device.screen.zip,
      deviceName: m.device.name,
      lastSeenAt: m.device.lastSeenAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/** Resolve paired device ids that belong to a group. */
export async function listDeviceIdsInGroup(groupId: string): Promise<string[]> {
  const rows = await prisma.deviceGroupMember.findMany({
    where: { groupId },
    select: { deviceId: true },
  });
  return rows.map((r) => r.deviceId);
}

/** Screen ids for devices in a group (for fleet filter). */
export async function listScreenIdsInGroup(groupId: string): Promise<string[]> {
  const rows = await prisma.deviceGroupMember.findMany({
    where: { groupId },
    select: { device: { select: { screenId: true } } },
  });
  return rows.map((r) => r.device.screenId);
}

export type AddMemberResult = {
  deviceId: string;
  ok: boolean;
  error?: string;
  memberId?: string;
};

/**
 * Add devices to a group. Rejects missing / unpaired (no Device row).
 * Idempotent: already-member → ok without duplicate.
 */
export async function addDevicesToGroup(opts: {
  groupId: string;
  deviceIds: string[];
}): Promise<{ results: AddMemberResult[]; added: number; skipped: number }> {
  const group = await prisma.deviceGroup.findUnique({
    where: { id: opts.groupId },
    select: { id: true },
  });
  if (!group) {
    return {
      results: opts.deviceIds.map((deviceId) => ({
        deviceId,
        ok: false,
        error: "Group not found",
      })),
      added: 0,
      skipped: opts.deviceIds.length,
    };
  }

  const unique = Array.from(
    new Set(opts.deviceIds.filter((id) => typeof id === "string" && id.length > 0))
  );
  const devices = await prisma.device.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  const exist = new Set(devices.map((d) => d.id));
  const existingMembers = await prisma.deviceGroupMember.findMany({
    where: { groupId: opts.groupId, deviceId: { in: unique } },
    select: { id: true, deviceId: true },
  });
  const memberByDevice = new Map(existingMembers.map((m) => [m.deviceId, m.id]));

  const results: AddMemberResult[] = [];
  let added = 0;
  let skipped = 0;

  for (const deviceId of unique) {
    if (!exist.has(deviceId)) {
      results.push({
        deviceId,
        ok: false,
        error: "Device not found or unpaired",
      });
      skipped++;
      continue;
    }
    const already = memberByDevice.get(deviceId);
    if (already) {
      results.push({ deviceId, ok: true, memberId: already });
      skipped++;
      continue;
    }
    try {
      const row = await prisma.deviceGroupMember.create({
        data: { groupId: opts.groupId, deviceId },
        select: { id: true },
      });
      results.push({ deviceId, ok: true, memberId: row.id });
      added++;
    } catch (e) {
      results.push({
        deviceId,
        ok: false,
        error: e instanceof Error ? e.message : "Failed to add",
      });
      skipped++;
    }
  }

  return { results, added, skipped };
}

export async function removeDevicesFromGroup(opts: {
  groupId: string;
  deviceIds: string[];
}): Promise<{ removed: number }> {
  const unique = Array.from(
    new Set(opts.deviceIds.filter((id) => typeof id === "string" && id.length > 0))
  );
  if (unique.length === 0) return { removed: 0 };
  const result = await prisma.deviceGroupMember.deleteMany({
    where: { groupId: opts.groupId, deviceId: { in: unique } },
  });
  return { removed: result.count };
}

/** Resolve deviceIds from screenIds (paired only). */
export async function deviceIdsForScreens(
  screenIds: string[]
): Promise<{ deviceId: string; screenId: string }[]> {
  const devices = await prisma.device.findMany({
    where: { screenId: { in: screenIds } },
    select: { id: true, screenId: true },
  });
  return devices.map((d) => ({ deviceId: d.id, screenId: d.screenId }));
}
