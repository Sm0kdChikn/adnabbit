-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "placementId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
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

-- CreateIndex
CREATE INDEX "Schedule_status_idx" ON "Schedule"("status");

-- CreateIndex
CREATE INDEX "Schedule_startAt_idx" ON "Schedule"("startAt");

-- CreateIndex
CREATE INDEX "Schedule_endAt_idx" ON "Schedule"("endAt");

-- CreateIndex
CREATE INDEX "Schedule_placementId_idx" ON "Schedule"("placementId");

-- CreateIndex
CREATE INDEX "Schedule_screenId_idx" ON "Schedule"("screenId");
