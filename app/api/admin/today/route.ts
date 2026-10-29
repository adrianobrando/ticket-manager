import { handleRouteError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { PRIORITY_RANK } from "@/lib/scheduler";

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

function getDeadlineStatus(
  deadlineType: string,
  dueDate: Date | null,
  scheduledEndDate: Date | null,
) {
  const beyondTarget = Boolean(
    dueDate &&
    scheduledEndDate &&
    startOfDay(scheduledEndDate).getTime() > startOfDay(dueDate).getTime()
  );
  return {
    delayed: deadlineType === "HARD" && beyondTarget,
    lateVsTarget: deadlineType !== "HARD" && beyondTarget,
  };
}

export async function GET(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;

    const today = new Date();
    const [workDays, pausedTickets, lateCandidates] = await Promise.all([
      prisma.workDay.findMany({
        where: {
          date: { gte: startOfDay(today), lte: endOfDay(today) },
          ticket: { paused: false },
        },
        include: {
          ticket: {
            include: {
              client: true,
              scheduledTask: true,
            },
          },
        },
      }),
      prisma.ticket.findMany({
        where: { paused: true },
        select: {
          id: true,
          title: true,
          pausedAt: true,
          dueDate: true,
          deadlineType: true,
          client: { select: { name: true } },
          scheduledTask: { select: { endDate: true } },
        },
      }),
      prisma.ticket.findMany({
        where: {
          dueDate: { not: null },
          scheduledTask: { isNot: null },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          deadlineType: true,
          client: { select: { name: true } },
          scheduledTask: { select: { endDate: true } },
        },
      }),
    ]);

    workDays.sort((a, b) => {
      const startA = a.ticket.scheduledTask?.startDate.getTime() ?? a.date.getTime();
      const startB = b.ticket.scheduledTask?.startDate.getTime() ?? b.date.getTime();
      if (startA !== startB) return startA - startB;

      const priorityA = PRIORITY_RANK[a.ticket.priority] ?? Number.MAX_SAFE_INTEGER;
      const priorityB = PRIORITY_RANK[b.ticket.priority] ?? Number.MAX_SAFE_INTEGER;
      if (priorityA !== priorityB) return priorityA - priorityB;

      return (a.ticket.scheduledTask?.sortOrder ?? 0) -
        (b.ticket.scheduledTask?.sortOrder ?? 0);
    });

    const orePianificateOggi = workDays.reduce(
      (total, workDay) => total + workDay.plannedHours,
      0,
    );

    const lateCandidatesWithStatus = lateCandidates.map((ticket) => ({
      ...ticket,
      ...getDeadlineStatus(
        ticket.deadlineType,
        ticket.dueDate,
        ticket.scheduledTask?.endDate ?? null,
      ),
    }));

    const totaleInRitardo = lateCandidatesWithStatus.filter(
      (ticket) => ticket.deadlineType === "HARD" && ticket.delayed,
    ).length;

    const ticketsSoftOltreTarget = lateCandidatesWithStatus.flatMap((ticket) =>
      ticket.lateVsTarget && ticket.dueDate && ticket.scheduledTask
        ? [{
            id: ticket.id,
            title: ticket.title,
            clientName: ticket.client.name,
            deadlineType: ticket.deadlineType,
            lateVsTarget: ticket.lateVsTarget,
            dueDate: ticket.dueDate.toISOString(),
            scheduledTaskEndDate: ticket.scheduledTask.endDate.toISOString(),
          }]
        : [],
    );

    return Response.json({
      data: localDateString(today),
      orePianificateOggi,
      oreLibere: Math.max(0, 8 - orePianificateOggi),
      ticketsOggi: workDays.map((workDay) => {
        const { ticket } = workDay;
        const deadlineStatus = getDeadlineStatus(
          ticket.deadlineType,
          ticket.dueDate,
          ticket.scheduledTask?.endDate ?? null,
        );
        return {
          id: ticket.id,
          title: ticket.title,
          clientName: ticket.client.name,
          priority: ticket.priority,
          deadlineType: ticket.deadlineType,
          ...deadlineStatus,
          oreStimate: ticket.oreStimate,
          orePianificateOggi: workDay.plannedHours,
          dueDate: ticket.dueDate?.toISOString() ?? null,
          inRitardo: Boolean(
            ticket.dueDate &&
            ticket.scheduledTask &&
            ticket.scheduledTask.endDate > ticket.dueDate
          ),
        };
      }),
      ticketsInPausa: pausedTickets.map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        clientName: ticket.client.name,
        deadlineType: ticket.deadlineType,
        lateVsTarget: getDeadlineStatus(
          ticket.deadlineType,
          ticket.dueDate,
          ticket.scheduledTask?.endDate ?? null,
        ).lateVsTarget,
        pausedAt: ticket.pausedAt?.toISOString() ?? null,
      })),
      ticketsSoftOltreTarget,
      totaleInRitardo,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
