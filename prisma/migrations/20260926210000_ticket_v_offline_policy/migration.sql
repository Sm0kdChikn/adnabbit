-- Ticket V — Host offline play policy (PLAY_CACHE | BLACKOUT) + cache TTL hours
-- Soft miss: per-screen override (not in this migration)

ALTER TABLE "Host" ADD COLUMN "offlinePolicy" TEXT NOT NULL DEFAULT 'PLAY_CACHE';
ALTER TABLE "Host" ADD COLUMN "offlineCacheTtlHours" INTEGER NOT NULL DEFAULT 24;
