import { handleRouteError, jsonError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Formato data non valido");
  return parsed;
}

export async function GET(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const today = new Date();
    const endDefault = new Date(today);
    endDefault.setDate(today.getDate() + 13);
    const start = parseDate(searchParams.get("start"), today);
    const end = parseDate(searchParams.get("end"), endDefault);
    if (start > end) return jsonError("L'intervallo delle date non è valido", 400);

    const days = await prisma.workDay.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        plannedHours: true,
        overflow: true,
        ticket: {
          select: {
            id: true, title: true, priority: true, estimatedHours: true, dueDate: true,
            scheduledTask: { select: { endDate: true } },
          },
        },
      },
    });

    days.sort((a, b) => {
      const dateDifference = a.date.getTime() - b.date.getTime();
      if (dateDifference !== 0) return dateDifference;
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (priorityOrder[a.ticket.priority] ?? 99) - (priorityOrder[b.ticket.priority] ?? 99);
    });

    return Response.json({
      start,
      end,
      days: days.map((day) => ({
        ...day,
        delayed: Boolean(day.ticket.dueDate && day.ticket.scheduledTask && day.ticket.scheduledTask.endDate > day.ticket.dueDate),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
