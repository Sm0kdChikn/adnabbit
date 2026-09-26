-- Ticket R — fleet health: player version/disk stubs + in-app alerts

ALTER TABLE "Device" ADD COLUMN "playerVersion" TEXT;
ALTER TABLE "Device" ADD COLUMN "diskFreeBytes" INTEGER;
ALTER TABLE "Device" ADD COLUMN "diskTotalBytes" INTEGER;

CREATE TABLE "FleetAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "screenId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "message" TEXT,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetAlert_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FleetAlert_status_idx" ON "FleetAlert"("status");
CREATE INDEX "FleetAlert_kind_idx" ON "FleetAlert"("kind");
CREATE INDEX "FleetAlert_screenId_kind_status_idx" ON "FleetAlert"("screenId", "kind", "status");
CREATE INDEX "FleetAlert_openedAt_idx" ON "FleetAlert"("openedAt");
