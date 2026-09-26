-- Ticket P — admin remote view via screenshot relay (epoch-style request + single overwrite JPEG)
ALTER TABLE "Device" ADD COLUMN "screenshotEpoch" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Device" ADD COLUMN "screenshotCapturedEpoch" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Device" ADD COLUMN "remoteViewImagePath" TEXT;
ALTER TABLE "Device" ADD COLUMN "remoteViewCapturedAt" DATETIME;
