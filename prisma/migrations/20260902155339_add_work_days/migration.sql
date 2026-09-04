-- CreateTable
CREATE TABLE "WorkDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "ticketId" TEXT NOT NULL,
    "plannedHours" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkDay_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorkDay_date_idx" ON "WorkDay"("date");

-- CreateIndex
CREATE INDEX "WorkDay_ticketId_idx" ON "WorkDay"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDay_date_ticketId_key" ON "WorkDay"("date", "ticketId");
