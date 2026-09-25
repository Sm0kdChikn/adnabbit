-- CreateTable
CREATE TABLE "AdminFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminFolderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folderId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AdminFolderItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "AdminFolder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdminFolder_scope_sortOrder_idx" ON "AdminFolder"("scope", "sortOrder");

-- CreateIndex
CREATE INDEX "AdminFolderItem_folderId_sortOrder_idx" ON "AdminFolderItem"("folderId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AdminFolderItem_targetType_targetId_key" ON "AdminFolderItem"("targetType", "targetId");
