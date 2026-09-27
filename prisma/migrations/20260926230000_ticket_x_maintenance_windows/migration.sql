-- Ticket X — one-off MaintenanceWindow (HOST|SCREEN); soft blackout beats force-live
-- Soft miss: recurring / bulk. Out: auto-reboot-into-window, OptiSigns, email; Y volume; Z groups

CREATE TABLE "MaintenanceWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "MaintenanceWindow_scope_targetId_idx" ON "MaintenanceWindow"("scope", "targetId");
CREATE INDEX "MaintenanceWindow_startsAt_endsAt_idx" ON "MaintenanceWindow"("startsAt", "endsAt");
CREATE INDEX "MaintenanceWindow_endsAt_idx" ON "MaintenanceWindow"("endsAt");
