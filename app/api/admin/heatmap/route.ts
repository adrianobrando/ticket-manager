import { handleRouteError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;

    const start = startOfDay(new Date());
    const lastDay = new Date(start);
    lastDay.setDate(lastDay.getDate() + 29);
    const end = endOfDay(lastDay);

    const days = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      return {
        date: localDateString(date),
        byType: {
          HARD: { hours: 0, ticketIds: new Set<string>() },
          SOFT: { hours: 0, ticketIds: new Set<string>() },
          NONE: { hours: 0, ticketIds: new Set<string>() },
        },
      };
    });
    const daysByDate = new Map(days.map((day) => [day.date, day]));

    const workDays = await prisma.workDay.findMany({
      where: {
        date: { gte: start, lte: end },
        ticket: { paused: false },
      },
      select: {
        date: true,
        plannedHours: true,
        ticketId: true,
        ticket: { select: { deadlineType: true } },
      },
    });

    for (const workDay of workDays) {
      const day = daysByDate.get(localDateString(workDay.date));
      if (!day) continue;

      const bucket = day.byType[workDay.ticket.deadlineType];
      bucket.hours += workDay.plannedHours;
      bucket.ticketIds.add(workDay.ticketId);
    }

    return Response.json(
      days.map(({ date, byType }) => ({
        date,
        byType: {
          HARD: { hours: byType.HARD.hours, ticketIds: [...byType.HARD.ticketIds] },
          SOFT: { hours: byType.SOFT.hours, ticketIds: [...byType.SOFT.ticketIds] },
          NONE: { hours: byType.NONE.hours, ticketIds: [...byType.NONE.ticketIds] },
        },
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
