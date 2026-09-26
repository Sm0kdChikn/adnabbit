-- Ticket P.1 — admin remote mouse/keyboard control (pending input queue drained by player)
ALTER TABLE "Device" ADD COLUMN "pendingInputJson" TEXT;
