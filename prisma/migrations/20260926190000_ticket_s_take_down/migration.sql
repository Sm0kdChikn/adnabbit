-- Ticket S — emergency take-down stamps + campaign windows reuse Schedule (Ticket E)

ALTER TABLE "User" ADD COLUMN "advertiserTakenDownAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "advertiserTakenDownById" TEXT;
ALTER TABLE "User" ADD COLUMN "advertiserTakenDownReason" TEXT;

ALTER TABLE "Creative" ADD COLUMN "takenDownAt" DATETIME;
ALTER TABLE "Creative" ADD COLUMN "takenDownById" TEXT;
ALTER TABLE "Creative" ADD COLUMN "takenDownReason" TEXT;
CREATE INDEX "Creative_takenDownAt_idx" ON "Creative"("takenDownAt");

ALTER TABLE "Host" ADD COLUMN "playbackTakenDownAt" DATETIME;
ALTER TABLE "Host" ADD COLUMN "playbackTakenDownById" TEXT;
ALTER TABLE "Host" ADD COLUMN "playbackTakenDownReason" TEXT;

ALTER TABLE "Screen" ADD COLUMN "playbackTakenDownAt" DATETIME;
ALTER TABLE "Screen" ADD COLUMN "playbackTakenDownById" TEXT;
ALTER TABLE "Screen" ADD COLUMN "playbackTakenDownReason" TEXT;
