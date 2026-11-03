import { handleRouteError, jsonError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Date-only => UTC midnight; `to` date-only is inclusive (end of that day).
function parseBound(value: string | null, isEnd: boolean) {
  if (!value) return null;
  const date = new Date(DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return isEnd && DATE_ONLY.test(value) ? new Date(date.getTime() + DAY_MS) : date;
}

const round = (n: number) => Math.round(n * 100) / 100;
const toArray = (map: Map<string, number>) =>
  [...map.entries()]
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value: round(value) }))
    .sort((a, b) => b.value - a.value);

export async function GET(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;

    const params = new URL(request.url).searchParams;
    const from = parseBound(params.get("from"), false);
    const to = parseBound(params.get("to"), true);
    if (!from || !to || to <= from) return jsonError("Intervallo non valido", 400);

    const range = { gte: from, lt: to };
    const ticketSelect = {
      id: true,
      stato: true,
      hourlyRate: true,
      fixedPrice: true,
      client: { select: { name: true } },
    } as const;

    const [workLogs, timeEntries, workDays] = await Promise.all([
      prisma.workLog.findMany({ where: { date: range }, select: { duration: true, ticket: { select: ticketSelect } } }),
      prisma.timeEntry.findMany({ where: { date: range }, select: { durationHours: true, ticket: { select: ticketSelect } } }),
      prisma.workDay.findMany({ where: { date: range }, select: { plannedHours: true, ticket: { select: { deadlineType: true } } } }),
    ]);

    const hoursByClient = new Map<string, number>();
    const hoursByTicket = new Map<string, { hours: number; ticket: (typeof workLogs)[number]["ticket"] }>();

    for (const { hours, ticket } of [
      ...workLogs.map((w) => ({ hours: w.duration, ticket: w.ticket })),
      ...timeEntries.map((t) => ({ hours: t.durationHours, ticket: t.ticket })),
    ]) {
      hoursByClient.set(ticket.client.name, (hoursByClient.get(ticket.client.name) ?? 0) + hours);
      const entry = hoursByTicket.get(ticket.id) ?? { hours: 0, ticket };
      entry.hours += hours;
      hoursByTicket.set(ticket.id, entry);
    }

    // Non esiste un campo completedAt: per i ticket a prezzo fisso completati,
    // il prezzo è attribuito al periodo dell'ultima registrazione di ore.
    const fixedIds = [...hoursByTicket.values()]
      .filter(({ ticket }) => ticket.fixedPrice != null && ticket.stato === "done")
      .map(({ ticket }) => ticket.id);
    const lastLogByTicket = new Map<string, Date>();
    if (fixedIds.length > 0) {
      const [lastWorkLogs, lastTimeEntries] = await Promise.all([
        prisma.workLog.groupBy({ by: ["ticketId"], where: { ticketId: { in: fixedIds } }, _max: { date: true } }),
        prisma.timeEntry.groupBy({ by: ["ticketId"], where: { ticketId: { in: fixedIds } }, _max: { date: true } }),
      ]);
      for (const row of [...lastWorkLogs, ...lastTimeEntries]) {
        const date = row._max.date;
        const current = lastLogByTicket.get(row.ticketId);
        if (date && (!current || date > current)) lastLogByTicket.set(row.ticketId, date);
      }
    }

    const revenueByClient = new Map<string, number>();
    for (const { hours, ticket } of hoursByTicket.values()) {
      let amount: number;
      if (ticket.fixedPrice != null && ticket.stato === "done") {
        const last = lastLogByTicket.get(ticket.id);
        amount = last && last >= from && last < to ? ticket.fixedPrice : 0;
      } else {
        amount = hours * (ticket.hourlyRate ?? 0);
      }
      revenueByClient.set(ticket.client.name, (revenueByClient.get(ticket.client.name) ?? 0) + amount);
    }

    const deadlines = new Map<string, number>([["HARD", 0], ["SOFT", 0], ["NONE", 0]]);
    for (const day of workDays) {
      const key = day.ticket.deadlineType;
      deadlines.set(key, (deadlines.get(key) ?? 0) + day.plannedHours);
    }

    return Response.json({
      orePerCliente: toArray(hoursByClient),
      fatturatoPerCliente: toArray(revenueByClient),
      distribuzioneScadenze: toArray(deadlines),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
