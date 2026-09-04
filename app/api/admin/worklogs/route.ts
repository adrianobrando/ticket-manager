import { handleRouteError, jsonError, readJsonBody, ValidationError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { calculateSchedule } from "@/lib/scheduler";
import { createWorkLogSchema } from "@/lib/validation";

function parseDate(value: string, field: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`Formato data non valido per "${field}"`);
  }
  return parsed;
}

function parseCalendarDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`Formato data non valido per "${field}"`);
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`Formato data non valido per "${field}"`);
  }
  return parsed;
}

export async function POST(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const input = createWorkLogSchema.parse(body.data);
    const date = parseDate(input.date, "date");
    const startTime = parseDate(input.startTime, "startTime");
    const endTime = parseDate(input.endTime, "endTime");
    const duration = (endTime.getTime() - startTime.getTime()) / 3_600_000;
    if (duration <= 0) return jsonError("endTime deve essere successivo a startTime", 400);

    const workLog = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: input.ticketId }, select: { id: true } });
      if (!ticket) return null;

      const created = await tx.workLog.create({
        data: {
          date,
          startTime,
          endTime,
          duration,
          ticketId: input.ticketId,
          notes: input.notes || null,
        },
        include: { ticket: { include: { client: true } } },
      });
      await tx.ticket.update({
        where: { id: input.ticketId },
        data: { actualHours: { increment: duration } },
      });
      return created;
    });

    if (!workLog) return jsonError("Ticket non trovato", 404);
    await calculateSchedule();
    return Response.json(workLog, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const startValue = searchParams.get("start");
    const endValue = searchParams.get("end");
    if (!startValue || !endValue) return jsonError("I parametri start ed end sono obbligatori", 400);

    const start = parseCalendarDate(startValue, "start");
    const end = parseCalendarDate(endValue, "end");
    const endExclusive = new Date(end);
    endExclusive.setDate(endExclusive.getDate() + 1);
    if (start >= endExclusive) return jsonError("L'intervallo delle date non è valido", 400);

    const worklogs = await prisma.workLog.findMany({
      where: { date: { gte: start, lt: endExclusive } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { ticket: { include: { client: true } } },
    });
    return Response.json({ start, end, worklogs });
  } catch (error) {
    return handleRouteError(error);
  }
}
