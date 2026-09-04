import { handleRouteError, jsonError, readJsonBody, ValidationError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { calculateSchedule } from "@/lib/scheduler";
import { timeEntrySchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

function parseDate(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) throw new ValidationError("Formato data non valido");
  return date;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { id } = await context.params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const input = timeEntrySchema.partial().parse(body.data);
    const existing = await prisma.timeEntry.findUnique({ where: { id } });
    if (!existing) return jsonError("Registrazione non trovata", 404);
    const date = input.date ? parseDate(input.date) : existing.date;
    const startTime = input.startTime ? parseDate(input.startTime) : existing.startTime;
    const endTime = input.endTime ? parseDate(input.endTime) : existing.endTime;
    const durationHours = Number(((endTime.getTime() - startTime.getTime()) / 3_600_000).toFixed(2));
    if (durationHours <= 0) return jsonError("endTime deve essere successivo a startTime", 400);
    const ticketId = input.ticketId ?? existing.ticketId;
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, contractId: true } });
    if (!ticket) return jsonError("Ticket non trovato", 404);
    const updated = await prisma.$transaction(async (transaction) => {
      const entry = await transaction.timeEntry.update({
        where: { id },
        data: { ticketId, contractId: ticket.contractId, date, startTime, endTime, durationHours, note: input.note ?? existing.note },
        include: { ticket: { include: { client: true } }, contract: true },
      });
      if (existing.ticketId !== ticketId) {
        await transaction.ticket.update({ where: { id: existing.ticketId }, data: { actualHours: { decrement: existing.durationHours } } });
        await transaction.ticket.update({ where: { id: ticketId }, data: { actualHours: { increment: durationHours } } });
      } else {
        await transaction.ticket.update({ where: { id: ticketId }, data: { actualHours: { increment: durationHours - existing.durationHours } } });
      }
      return entry;
    });
    await calculateSchedule();
    return Response.json(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { id } = await context.params;
    const deleted = await prisma.timeEntry.findUnique({ where: { id }, select: { ticketId: true, durationHours: true } });
    if (!deleted) return jsonError("Registrazione non trovata", 404);
    await prisma.$transaction([
      prisma.timeEntry.delete({ where: { id } }),
      prisma.ticket.update({ where: { id: deleted.ticketId }, data: { actualHours: { decrement: deleted.durationHours } } }),
    ]);
    await calculateSchedule();
    return Response.json({ deleted: true, id });
  } catch (error) {
    return handleRouteError(error);
  }
}
