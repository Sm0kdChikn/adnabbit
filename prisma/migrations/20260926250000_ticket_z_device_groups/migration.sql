-- Ticket Z — DeviceGroup / DeviceGroupMember (flat admin groups of paired devices)
-- Soft miss: nested groups, host-owned groups. Out: auto-geo, new roles, OptiSigns.

CREATE TABLE "DeviceGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "DeviceGroup_name_idx" ON "DeviceGroup"("name");

CREATE TABLE "DeviceGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DeviceGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeviceGroupMember_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeviceGroupMember_groupId_deviceId_key" ON "DeviceGroupMember"("groupId", "deviceId");
CREATE INDEX "DeviceGroupMember_deviceId_idx" ON "DeviceGroupMember"("deviceId");
CREATE INDEX "DeviceGroupMember_groupId_idx" ON "DeviceGroupMember"("groupId");
