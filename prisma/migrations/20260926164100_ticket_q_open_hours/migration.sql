-- Ticket Q — venue / screen open hours, force-live override, player playback state
-- CreateTable
CREATE TABLE "OpenHours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "openTime" TEXT,
    "closeTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenHours_scope_targetId_weekday_key" ON "OpenHours"("scope", "targetId", "weekday");

-- CreateIndex
CREATE INDEX "OpenHours_scope_targetId_idx" ON "OpenHours"("scope", "targetId");

-- AlterTable Screen
ALTER TABLE "Screen" ADD COLUMN "useCustomHours" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Screen" ADD COLUMN "forceLiveUntil" DATETIME;

-- AlterTable Device
ALTER TABLE "Device" ADD COLUMN "playbackState" TEXT;
ALTER TABLE "Device" ADD COLUMN "playbackStateAt" DATETIME;
