-- CreateTable
CREATE TABLE "PlayImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "insertedCount" INTEGER NOT NULL,
    "skippedDupes" INTEGER NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "PlayImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT,
    "reportDateUtc" DATETIME NOT NULL,
    "accountId" TEXT,
    "screenUuid" TEXT NOT NULL,
    "screenName" TEXT NOT NULL,
    "screenTags" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetTags" TEXT,
    "startTimeUtc" DATETIME NOT NULL,
    "deviceLocalTime" TEXT NOT NULL,
    "deviceTimezone" TEXT,
    "durationSec" INTEGER NOT NULL,
    "creativeId" TEXT,
    "isHostFiller" BOOLEAN NOT NULL DEFAULT false,
    "rawHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayEvent_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PlayImport" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlayEvent_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayEvent_rawHash_key" ON "PlayEvent"("rawHash");

-- CreateIndex
CREATE INDEX "PlayEvent_startTimeUtc_idx" ON "PlayEvent"("startTimeUtc");

-- CreateIndex
CREATE INDEX "PlayEvent_screenUuid_idx" ON "PlayEvent"("screenUuid");

-- CreateIndex
CREATE INDEX "PlayEvent_assetId_idx" ON "PlayEvent"("assetId");

-- CreateIndex
CREATE INDEX "PlayEvent_creativeId_idx" ON "PlayEvent"("creativeId");

-- CreateIndex
CREATE INDEX "PlayEvent_isHostFiller_idx" ON "PlayEvent"("isHostFiller");

-- CreateIndex
CREATE INDEX "PlayEvent_importId_idx" ON "PlayEvent"("importId");
