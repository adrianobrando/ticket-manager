-- CreateEnum
CREATE TYPE "TicketStato" AS ENUM ('todo', 'in_progress', 'review', 'done');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "oreConsuntivate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "oreStimate" DOUBLE PRECISION,
ADD COLUMN     "stato" "TicketStato" NOT NULL DEFAULT 'todo';

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "visibileCliente" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkLog" ADD COLUMN     "visibileCliente" BOOLEAN NOT NULL DEFAULT false;
