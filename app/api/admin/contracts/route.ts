import { handleRouteError, jsonError, readJsonBody, ValidationError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { contractSchema } from "@/lib/validation";

function parseDate(value: string, field: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`Formato data non valido per "${field}"`);
  return date;
}

export async function GET(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const clientId = new URL(request.url).searchParams.get("clientId");
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const contracts = await prisma.clientContract.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
      include: { client: true, tickets: { select: { id: true, title: true, status: true } } },
    });
    const contractIds = contracts.map((contract) => contract.id);
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        date: { gte: monthStart, lt: nextMonthStart },
        OR: [
          { contractId: { in: contractIds } },
          { contractId: null, ticket: { contractId: { in: contractIds } } },
        ],
      },
      select: { contractId: true, date: true, durationHours: true, ticket: { select: { contractId: true } } },
    });
    const usageByContract = new Map<string, number>();
    for (const contract of contracts) {
      const registeredHours = timeEntries
        .filter((timeEntry) => {
          const contractId = timeEntry.contractId ?? timeEntry.ticket.contractId;
          return contractId === contract.id
            && timeEntry.date >= contract.startDate
            && (!contract.endDate || timeEntry.date <= contract.endDate);
        })
        .reduce((total, timeEntry) => total + timeEntry.durationHours, 0);
      usageByContract.set(contract.id, registeredHours);
    }
    return Response.json({
      contracts: contracts.map((contract) => ({
        ...contract,
        registeredHours: usageByContract.get(contract.id) ?? 0,
        remainingHours: (contract.monthlyHoursIncluded ?? 0) - (usageByContract.get(contract.id) ?? 0),
      })),
    });
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
    const input = contractSchema.parse(body.data);
    const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } });
    if (!client) return jsonError("Cliente non trovato", 404);
    if (input.type === "RETAINER" && input.monthlyHoursIncluded == null) {
      return jsonError("monthlyHoursIncluded è obbligatorio per i contratti retainer", 400);
    }
    const contract = await prisma.clientContract.create({
      data: {
        ...input,
        startDate: parseDate(input.startDate, "startDate"),
        endDate: input.endDate ? parseDate(input.endDate, "endDate") : null,
        monthlyHoursIncluded: input.type === "RETAINER" ? input.monthlyHoursIncluded : null,
      },
      include: { client: true },
    });
    return Response.json(contract, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
