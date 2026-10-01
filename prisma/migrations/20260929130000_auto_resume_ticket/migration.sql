CREATE OR REPLACE FUNCTION public.auto_resume_ticket_on_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE "Ticket"
  SET paused = false,
      "pausedAt" = NULL
  WHERE "id" = NEW."ticketId"
    AND paused = true;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "auto_resume_ticket_timeentry"
AFTER INSERT
ON "TimeEntry"
FOR EACH ROW
EXECUTE FUNCTION public.auto_resume_ticket_on_activity();

CREATE TRIGGER "auto_resume_ticket_worklog"
AFTER INSERT
ON "WorkLog"
FOR EACH ROW
EXECUTE FUNCTION public.auto_resume_ticket_on_activity();
