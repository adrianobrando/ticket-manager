import { handleRouteError, jsonError, readJsonBody, ValidationError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { calculateSchedule } from "@/lib/scheduler";
import { timeEntrySchema } from "@/lib/validation";

function parseDate(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) throw new ValidationError("Formato data non valido");
  return date;
}

export async function GET(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const params = new URL(request.url).searchParams;
    const from = params.get("from");
    const to = params.get("to");
    if (!from || !to) return jsonError("I parametri from e to sono obbligatori", 400);
    const where = {
      date: { gte: parseDate(from), lt: new Date(parseDate(to).getTime() + 86_400_000) },
      ...(params.get("ticketId") ? { ticketId: params.get("ticketId")! } : {}),
      ...(params.get("contractId") ? { contractId: params.get("contractId")! } : {}),
      ...(params.get("clientId") ? { ticket: { clientId: params.get("clientId")! } } : {}),
    };
    const timeEntries = await prisma.timeEntry.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { ticket: { include: { client: true } }, contract: true },
    });
    return Response.json({ timeEntries });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const input = timeEntrySchema.parse(body.data);
    const date = parseDate(input.date);
    const startTime = parseDate(input.startTime);
    const endTime = parseDate(input.endTime);
    const durationHours = Number(((endTime.getTime() - startTime.getTime()) / 3_600_000).toFixed(2));
    if (durationHours <= 0) return jsonError("endTime deve essere successivo a startTime", 400);
    const ticket = await prisma.ticket.findUnique({
      where: { id: input.ticketId },
      select: { id: true, contractId: true },
    });
    if (!ticket) return jsonError("Ticket non trovato", 404);
    const timeEntry = await prisma.timeEntry.create({
      data: {
        ticketId: ticket.id,
        contractId: ticket.contractId,
        date,
        startTime,
        endTime,
        durationHours,
        note: input.note || null,
      },
      include: { ticket: { include: { client: true } }, contract: true },
    });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { actualHours: { increment: durationHours } },
    });
    await calculateSchedule();
    return Response.json(timeEntry, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
