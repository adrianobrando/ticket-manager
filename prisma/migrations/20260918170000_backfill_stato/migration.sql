-- Backfill una tantum: riallinea "Ticket"."stato" per i ticket esistenti
-- applicando la stessa regola del trigger sync_ticket_stato() introdotto
-- nella migration 20260918162144_sync_ticket_stato.
--
-- IMPORTANTE: il trigger calcola le ore totali dalla somma effettiva di
-- "TimeEntry"."durationHours" + "WorkLog"."duration" (non dal campo
-- "Ticket"."oreConsuntivate", che potrebbe essere disallineato). Il backfill
-- deve quindi ricalcolare le ore totali allo stesso modo del trigger.
--
-- Ordine dei rami CASE (importante):
--   1. status = 'completed'            -> done
--   2. ore_totali = 0                  -> todo
--   3. oreStimate nullo/<=0            -> in_progress
--   4. ore_totali >= oreStimate        -> review
--   5. altrimenti                      -> in_progress
--
-- Nota: "UPDATE ... FROM <CTE>" esegue un JOIN implicito, quindi i ticket
-- senza alcuna riga in "TimeEntry"/"WorkLog" (ore_totali = 0) non compaiono
-- nella CTE e vanno gestiti con un secondo UPDATE separato.

-- 1) Ticket CON ore registrate (somma da TimeEntry + WorkLog)
WITH ore_per_ticket AS (
  SELECT "ticketId", SUM(h) AS ore_totali FROM (
    SELECT "ticketId", "durationHours" AS h FROM "TimeEntry"
    UNION ALL
    SELECT "ticketId", "duration"      AS h FROM "WorkLog"
  ) x GROUP BY "ticketId"
)
UPDATE "Ticket" t SET "stato" = CASE
  WHEN t."status" = 'completed'                     THEN 'done'::"TicketStato"
  WHEN COALESCE(o.ore_totali, 0) = 0                 THEN 'todo'::"TicketStato"
  WHEN t."oreStimate" IS NULL OR t."oreStimate" <= 0 THEN 'in_progress'::"TicketStato"
  WHEN COALESCE(o.ore_totali, 0) >= t."oreStimate"   THEN 'review'::"TicketStato"
  ELSE 'in_progress'::"TicketStato"
END
FROM ore_per_ticket o
WHERE t."id" = o."ticketId" AND t."status" <> 'cancelled';

-- 2) Ticket SENZA ore registrate (nessuna riga in TimeEntry/WorkLog)
UPDATE "Ticket" t SET "stato" = CASE
  WHEN t."status" = 'completed' THEN 'done'::"TicketStato"
  ELSE 'todo'::"TicketStato"
END
WHERE t."status" <> 'cancelled'
  AND NOT EXISTS (SELECT 1 FROM "TimeEntry" te WHERE te."ticketId" = t."id")
  AND NOT EXISTS (SELECT 1 FROM "WorkLog" wl WHERE wl."ticketId" = t."id");

-- SELECT di controllo (da eseguire a mano dopo l'applicazione)
-- SELECT id, title, status, "oreStimate", "oreConsuntivate", stato FROM "Ticket" ORDER BY "createdAt" DESC;
