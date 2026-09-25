-- Ticket G: Host self-serve portal — optional owning User on Host
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Host" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "otherLabel" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Denver',
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Host_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Host" ("id", "name", "vertical", "otherLabel", "timezone", "notes", "createdAt", "updatedAt")
SELECT "id", "name", "vertical", "otherLabel", "timezone", "notes", "createdAt", "updatedAt" FROM "Host";
DROP TABLE "Host";
ALTER TABLE "new_Host" RENAME TO "Host";
CREATE UNIQUE INDEX "Host_userId_key" ON "Host"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
