CREATE OR REPLACE FUNCTION sync_ticket_stato()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_id TEXT;
  v_ticket_ids TEXT[];
  v_status TEXT;
  v_ore_stimate DOUBLE PRECISION;
  v_total_hours DOUBLE PRECISION;
BEGIN
  IF TG_TABLE_NAME = 'Ticket' AND TG_OP = 'UPDATE'
     AND (to_jsonb(NEW)->>'status') IS NOT DISTINCT FROM (to_jsonb(OLD)->>'status')
     AND (to_jsonb(NEW)->>'oreStimate') IS NOT DISTINCT FROM (to_jsonb(OLD)->>'oreStimate')
     AND (to_jsonb(NEW)->>'oreConsuntivate') IS NOT DISTINCT FROM (to_jsonb(OLD)->>'oreConsuntivate')
  THEN
    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME = 'Ticket' THEN
    v_ticket_ids := ARRAY[NEW."id"];
  ELSIF TG_OP = 'DELETE' THEN
    v_ticket_ids := ARRAY[OLD."ticketId"];
  ELSIF TG_OP = 'UPDATE' AND NEW."ticketId" IS DISTINCT FROM OLD."ticketId" THEN
    v_ticket_ids := ARRAY[OLD."ticketId", NEW."ticketId"];
  ELSE
    v_ticket_ids := ARRAY[NEW."ticketId"];
  END IF;

  FOREACH v_ticket_id IN ARRAY v_ticket_ids LOOP
    SELECT "status", "oreStimate"
      INTO v_status, v_ore_stimate
    FROM "Ticket"
    WHERE "id" = v_ticket_id;

    IF NOT FOUND OR v_status = 'cancelled' THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(h), 0)
      INTO v_total_hours
    FROM (
      SELECT "durationHours" AS h
      FROM "TimeEntry"
      WHERE "ticketId" = v_ticket_id

      UNION ALL

      SELECT "duration" AS h
      FROM "WorkLog"
      WHERE "ticketId" = v_ticket_id
    ) t;

    IF v_status = 'completed' THEN
      UPDATE "Ticket"
      SET "stato" = 'done'
      WHERE "id" = v_ticket_id;
      CONTINUE;
    END IF;

    IF v_total_hours = 0 THEN
      UPDATE "Ticket"
      SET "stato" = 'todo'
      WHERE "id" = v_ticket_id;
      CONTINUE;
    END IF;

    IF v_ore_stimate IS NULL OR v_ore_stimate <= 0 THEN
      UPDATE "Ticket"
      SET "stato" = 'in_progress'
      WHERE "id" = v_ticket_id;
      CONTINUE;
    END IF;

    IF v_total_hours >= v_ore_stimate THEN
      UPDATE "Ticket"
      SET "stato" = 'review'
      WHERE "id" = v_ticket_id;
    ELSE
      UPDATE "Ticket"
      SET "stato" = 'in_progress'
      WHERE "id" = v_ticket_id;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE TRIGGER "sync_ticket_stato_timeentry"
AFTER INSERT OR UPDATE OR DELETE
ON "TimeEntry"
FOR EACH ROW
EXECUTE FUNCTION sync_ticket_stato();

CREATE TRIGGER "sync_ticket_stato_worklog"
AFTER INSERT OR UPDATE OR DELETE
ON "WorkLog"
FOR EACH ROW
EXECUTE FUNCTION sync_ticket_stato();

CREATE TRIGGER "sync_ticket_stato_ticket"
AFTER UPDATE OF "status", "oreStimate", "oreConsuntivate"
ON "Ticket"
FOR EACH ROW
EXECUTE FUNCTION sync_ticket_stato();
