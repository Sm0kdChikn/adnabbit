-- Ticket O — playlistEpoch for force playlist refresh (player compares on heartbeat / playlist GET)
ALTER TABLE "Device" ADD COLUMN "playlistEpoch" INTEGER NOT NULL DEFAULT 0;
