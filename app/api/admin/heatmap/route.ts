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
        plannedHours: 0,
        ticketIds: new Set<string>(),
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
      },
    });

    for (const workDay of workDays) {
      const day = daysByDate.get(localDateString(workDay.date));
      if (!day) continue;

      day.plannedHours += workDay.plannedHours;
      day.ticketIds.add(workDay.ticketId);
    }

    return Response.json(
      days.map(({ date, plannedHours, ticketIds }) => ({
        date,
        plannedHours,
        ticketCount: ticketIds.size,
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
