-- Ticket U — host download / quiet hours (sibling to OpenHours)
CREATE TABLE "DownloadHours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "openTime" TEXT,
    "closeTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "DownloadHours_scope_targetId_weekday_key" ON "DownloadHours"("scope", "targetId", "weekday");
CREATE INDEX "DownloadHours_scope_targetId_idx" ON "DownloadHours"("scope", "targetId");
