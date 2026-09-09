-- Retainer tickets do not represent a finite amount of work.
ALTER TABLE "Ticket" ALTER COLUMN "estimatedHours" DROP NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "estimatedHours" DROP DEFAULT;
