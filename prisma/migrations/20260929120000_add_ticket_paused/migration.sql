-- Migration: 20260929120000_add_ticket_paused
-- Adds paused and pausedAt columns to Ticket

ALTER TABLE "Ticket"
  ADD COLUMN paused BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Ticket"
  ADD COLUMN "pausedAt" TIMESTAMP(3) NULL;
