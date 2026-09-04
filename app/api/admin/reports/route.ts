import { handleRouteError, jsonError, ValidationError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function parseDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`Formato data non valido per "${field}"`);
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`Formato data non valido per "${field}"`);
  return date;
}

export async function GET(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;

    const params = new URL(request.url).searchParams;
    const contractId = params.get("contractId");
    const ticketId = params.get("ticketId");
    const fromValue = params.get("from");
    const toValue = params.get("to");
    if ((!contractId && !ticketId) || !fromValue || !toValue) {
      return jsonError("Specificare contractId o ticketId, from e to", 400);
    }

    const from = parseDate(fromValue, "from");
    const to = new Date(parseDate(toValue, "to").getTime() + 86_400_000);
    if (to <= from) return jsonError("L'intervallo del report non è valido", 400);

    const [contract, ticket] = await Promise.all([
      contractId
        ? prisma.clientContract.findUnique({
            where: { id: contractId },
            select: {
              id: true,
              name: true,
              client: { select: { name: true } },
              tickets: { select: { id: true, title: true }, orderBy: { title: "asc" } },
            },
          })
        : null,
      ticketId
        ? prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { id: true, title: true, description: true, client: { select: { name: true } } },
          })
        : null,
    ]);
    if (contractId && !contract) return jsonError("Contratto non trovato", 404);
    if (ticketId && !ticket) return jsonError("Ticket non trovato", 404);

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        date: { gte: from, lt: to },
        ...(ticketId ? { ticketId } : {}),
        ...(contractId
          ? {
              OR: [
                { contractId },
                { contractId: null, ticket: { contractId } },
              ],
            }
          : {}),
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        durationHours: true,
        note: true,
        ticket: { select: { id: true, title: true, description: true } },
      },
    });

    return Response.json({
      contract,
      ticket,
      from: fromValue,
      to: toValue,
      timeEntries,
      tickets: contract?.tickets ?? (ticket ? [{ id: ticket.id, title: ticket.title }] : []),
      totalHours: timeEntries.reduce((total, entry) => total + entry.durationHours, 0),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
