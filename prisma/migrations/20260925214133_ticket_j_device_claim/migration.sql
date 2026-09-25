-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "screenId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT,
    "lastSeenAt" DATETIME,
    "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScreenClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "screenId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreenClaim_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_screenId_key" ON "Device"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_tokenHash_key" ON "Device"("tokenHash");

-- CreateIndex
CREATE INDEX "Device_lastSeenAt_idx" ON "Device"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenClaim_code_key" ON "ScreenClaim"("code");

-- CreateIndex
CREATE INDEX "ScreenClaim_screenId_idx" ON "ScreenClaim"("screenId");

-- CreateIndex
CREATE INDEX "ScreenClaim_expiresAt_idx" ON "ScreenClaim"("expiresAt");
