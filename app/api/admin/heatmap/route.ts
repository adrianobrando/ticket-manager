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

function emptyPrioritySets() {
  return {
    urgent: new Set<string>(),
    high: new Set<string>(),
    normal: new Set<string>(),
    low: new Set<string>(),
  };
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
          HARD: { hours: 0, ticketIds: new Set<string>(), priorities: emptyPrioritySets() },
          SOFT: { hours: 0, ticketIds: new Set<string>(), priorities: emptyPrioritySets() },
          NONE: { hours: 0, ticketIds: new Set<string>(), priorities: emptyPrioritySets() },
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
        ticket: { select: { deadlineType: true, priority: true } },
      },
    });

    for (const workDay of workDays) {
      const day = daysByDate.get(localDateString(workDay.date));
      if (!day) continue;

      const bucket = day.byType[workDay.ticket.deadlineType];
      bucket.hours += workDay.plannedHours;
      bucket.ticketIds.add(workDay.ticketId);
      const priority = workDay.ticket.priority;
      if (priority === "urgent" || priority === "high" || priority === "normal" || priority === "low") {
        bucket.priorities[priority].add(workDay.ticketId);
      }
    }

    return Response.json(
      days.map(({ date, byType }) => ({
        date,
        byType: {
          HARD: {
            hours: byType.HARD.hours,
            ticketIds: [...byType.HARD.ticketIds],
            priorities: {
              urgent: [...byType.HARD.priorities.urgent],
              high: [...byType.HARD.priorities.high],
              normal: [...byType.HARD.priorities.normal],
              low: [...byType.HARD.priorities.low],
            },
          },
          SOFT: {
            hours: byType.SOFT.hours,
            ticketIds: [...byType.SOFT.ticketIds],
            priorities: {
              urgent: [...byType.SOFT.priorities.urgent],
              high: [...byType.SOFT.priorities.high],
              normal: [...byType.SOFT.priorities.normal],
              low: [...byType.SOFT.priorities.low],
            },
          },
          NONE: {
            hours: byType.NONE.hours,
            ticketIds: [...byType.NONE.ticketIds],
            priorities: {
              urgent: [...byType.NONE.priorities.urgent],
              high: [...byType.NONE.priorities.high],
              normal: [...byType.NONE.priorities.normal],
              low: [...byType.NONE.priorities.low],
            },
          },
        },
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
