-- Ticket E: Host.timezone + Schedule recurring dayparts (ONE_OFF | RECURRING)

-- Redefine Host with timezone (SQLite)
CREATE TABLE "new_Host" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "otherLabel" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Denver',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Host" ("id", "name", "vertical", "otherLabel", "notes", "createdAt", "updatedAt")
SELECT "id", "name", "vertical", "otherLabel", "notes", "createdAt", "updatedAt" FROM "Host";
DROP TABLE "Host";
ALTER TABLE "new_Host" RENAME TO "Host";

-- Redefine Schedule with kind + recurring fields; startAt/endAt nullable
CREATE TABLE "new_Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "placementId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ONE_OFF',
    "startAt" DATETIME,
    "endAt" DATETIME,
    "weekdays" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "campaignStartDate" TEXT,
    "campaignEndDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Schedule_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "PlacementRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Schedule_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Schedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Schedule" ("id", "placementId", "screenId", "kind", "startAt", "endAt", "status", "note", "createdById", "cancelledAt", "createdAt", "updatedAt")
SELECT "id", "placementId", "screenId", 'ONE_OFF', "startAt", "endAt", "status", "note", "createdById", "cancelledAt", "createdAt", "updatedAt" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE INDEX "Schedule_status_idx" ON "Schedule"("status");
CREATE INDEX "Schedule_kind_idx" ON "Schedule"("kind");
CREATE INDEX "Schedule_startAt_idx" ON "Schedule"("startAt");
CREATE INDEX "Schedule_endAt_idx" ON "Schedule"("endAt");
CREATE INDEX "Schedule_campaignStartDate_idx" ON "Schedule"("campaignStartDate");
CREATE INDEX "Schedule_campaignEndDate_idx" ON "Schedule"("campaignEndDate");
CREATE INDEX "Schedule_placementId_idx" ON "Schedule"("placementId");
CREATE INDEX "Schedule_screenId_idx" ON "Schedule"("screenId");
