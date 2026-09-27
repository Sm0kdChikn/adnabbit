import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { writeAuditEvent } from "@/lib/audit";
import {
  addDevicesToGroup,
  deviceIdsForScreens,
  getDeviceGroupDetail,
  removeDevicesFromGroup,
} from "@/lib/device-groups";

type Ctx = { params: { id: string } };

function parseIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw.filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );
}

/**
 * POST /api/admin/device-groups/:id/members
 * Body: { deviceIds?: string[], screenIds?: string[] }
 * At least one list required. screenIds resolved to paired devices.
 * Unpaired / missing → per-id error (not all-or-nothing).
 */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const group = await prisma.deviceGroup.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  let body: { deviceIds?: unknown; screenIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let deviceIds = parseIdList(body.deviceIds);
  const screenIds = parseIdList(body.screenIds);

  if (deviceIds.length === 0 && screenIds.length === 0) {
    return NextResponse.json(
      { error: "deviceIds or screenIds required" },
      { status: 400 }
    );
  }

  const screenResults: {
    screenId: string;
    ok: boolean;
    error?: string;
    deviceId?: string;
  }[] = [];

  if (screenIds.length > 0) {
    const paired = await deviceIdsForScreens(screenIds);
    const byScreen = new Map(paired.map((p) => [p.screenId, p.deviceId]));
    for (const screenId of screenIds) {
      const deviceId = byScreen.get(screenId);
      if (!deviceId) {
        screenResults.push({
          screenId,
          ok: false,
          error: "No device paired",
        });
      } else {
        screenResults.push({ screenId, ok: true, deviceId });
        deviceIds.push(deviceId);
      }
    }
    deviceIds = Array.from(new Set(deviceIds));
  }

  if (deviceIds.length > 100) {
    return NextResponse.json(
      { error: "Too many devices (max 100)" },
      { status: 400 }
    );
  }

  const { results, added, skipped } = await addDevicesToGroup({
    groupId: params.id,
    deviceIds,
  });

  await writeAuditEvent({
    actorUserId: auth.user.id,
    action: "device_group.member_add",
    targetType: "device_group",
    targetId: params.id,
    meta: {
      groupName: group.name,
      deviceIds,
      screenIds: screenIds.length ? screenIds : undefined,
      added,
      skipped,
      results,
      screenResults: screenResults.length ? screenResults : undefined,
    },
  });

  const detail = await getDeviceGroupDetail(params.id);
  return NextResponse.json({
    ok: true,
    added,
    skipped,
    results,
    screenResults: screenResults.length ? screenResults : undefined,
    group: detail,
  });
}

/**
 * DELETE /api/admin/device-groups/:id/members
 * Body: { deviceIds?: string[], screenIds?: string[] }
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const group = await prisma.deviceGroup.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  let body: { deviceIds?: unknown; screenIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let deviceIds = parseIdList(body.deviceIds);
  const screenIds = parseIdList(body.screenIds);

  if (deviceIds.length === 0 && screenIds.length === 0) {
    return NextResponse.json(
      { error: "deviceIds or screenIds required" },
      { status: 400 }
    );
  }

  if (screenIds.length > 0) {
    const paired = await deviceIdsForScreens(screenIds);
    deviceIds = Array.from(
      new Set([...deviceIds, ...paired.map((p) => p.deviceId)])
    );
  }

  const { removed } = await removeDevicesFromGroup({
    groupId: params.id,
    deviceIds,
  });

  await writeAuditEvent({
    actorUserId: auth.user.id,
    action: "device_group.member_remove",
    targetType: "device_group",
    targetId: params.id,
    meta: {
      groupName: group.name,
      deviceIds,
      screenIds: screenIds.length ? screenIds : undefined,
      removed,
    },
  });

  const detail = await getDeviceGroupDetail(params.id);
  return NextResponse.json({
    ok: true,
    removed,
    group: detail,
  });
}
