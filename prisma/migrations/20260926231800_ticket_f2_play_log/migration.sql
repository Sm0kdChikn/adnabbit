-- Ticket F2 — first-party device PlayLog (separate from OptiSigns PlayEvent)
-- Soft miss: rich charts, durable offline queue. Out: OptiSigns cutover, Looker parity.

CREATE TABLE "PlayLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "durationMs" INTEGER,
    "clientEventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayLog_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayLog_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayLog_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PlayLog_deviceId_clientEventId_key" ON "PlayLog"("deviceId", "clientEventId");
CREATE INDEX "PlayLog_screenId_startedAt_idx" ON "PlayLog"("screenId", "startedAt");
CREATE INDEX "PlayLog_creativeId_startedAt_idx" ON "PlayLog"("creativeId", "startedAt");
CREATE INDEX "PlayLog_deviceId_startedAt_idx" ON "PlayLog"("deviceId", "startedAt");
CREATE INDEX "PlayLog_startedAt_idx" ON "PlayLog"("startedAt");
