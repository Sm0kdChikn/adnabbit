-- Ticket Y — volume / brightness remote (sticky prefs + last-applied)
-- Soft miss: host self-service, fleet bulk. Out: CEC TV, sensors, per-creative gain, OptiSigns; Z groups

ALTER TABLE "Host" ADD COLUMN "defaultVolume" INTEGER;
ALTER TABLE "Host" ADD COLUMN "defaultBrightness" INTEGER;

ALTER TABLE "Screen" ADD COLUMN "volume" INTEGER;
ALTER TABLE "Screen" ADD COLUMN "brightness" INTEGER;

ALTER TABLE "Device" ADD COLUMN "lastAppliedVolume" INTEGER;
ALTER TABLE "Device" ADD COLUMN "lastAppliedBrightness" INTEGER;
