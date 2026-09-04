-- Add an explicit capacity indicator to each daily allocation.
ALTER TABLE "WorkDay" ADD COLUMN "overflow" BOOLEAN NOT NULL DEFAULT false;
