import { prisma } from "@/lib/prisma";

export const WORK_HOURS_PER_DAY = Number(process.env.WORK_HOURS_PER_DAY) || 8;
export const MAX_TICKET_HOURS_PER_DAY = 4;
export const MIN_TICKET_HOURS_PER_DAY = 0.5;
export const WORK_START_HOUR = 9;

export const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const EXCLUDED_STATUSES = ["completed", "cancelled"];
const HOURS_PRECISION = 100;

export function roundHours(value: number) {
  return Math.round(value * HOURS_PRECISION) / HOURS_PRECISION;
}
type TicketForSchedule = {
  id: string;
  token: string;
  title: string;
  priority: string;
  status: string;
  createdAt: Date;
  dueDate: Date | null;
  estimatedHours: number;
  client: { name: string; email: string };
};

export type ScheduleResult = TicketForSchedule & {
  scheduledTask: { startDate: Date; endDate: Date; sortOrder: number } | null;
  workDays: { date: Date; plannedHours: number }[];
  delayed: boolean;
};

function compareTickets(a: TicketForSchedule, b: TicketForSchedule) {
  const priorityDifference =
    (PRIORITY_RANK[a.priority] ?? Number.MAX_SAFE_INTEGER) -
    (PRIORITY_RANK[b.priority] ?? Number.MAX_SAFE_INTEGER);
  if (priorityDifference !== 0) return priorityDifference;
  if (a.dueDate && b.dueDate) {
    const dueDateDifference = a.dueDate.getTime() - b.dueDate.getTime();
    if (dueDateDifference !== 0) return dueDateDifference;
  } else if (a.dueDate) {
    return -1;
  } else if (b.dueDate) {
    return 1;
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
}

function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function nextWorkDay(date: Date) {
  const result = startOfDay(date);
  do {
    result.setDate(result.getDate() + 1);
  } while (isWeekend(result));
  return result;
}

function workDaysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    if (!isWeekend(cursor)) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function dateKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function addWorkHours(start: Date, hours: number) {
  const result = new Date(start);
  result.setHours(WORK_START_HOUR + hours, 0, 0, 0);
  return result;
}

function getInitialDays(now: Date, ticket: TicketForSchedule) {
  if (ticket.dueDate) return workDaysBetween(now, ticket.dueDate);
  const daysNeeded = Math.max(1, Math.ceil(ticket.estimatedHours / WORK_HOURS_PER_DAY));
  const days: Date[] = [];
  const cursor = startOfDay(now);
  while (days.length < daysNeeded) {
    if (!isWeekend(cursor)) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function toWorkCursor(date: Date): Date {
  const result = new Date(date);
  if (isWeekend(result)) {
    return startOfDay(result.getDay() === 6 ? new Date(result.setDate(result.getDate() + 2)) : new Date(result.setDate(result.getDate() + 1)));
  }
  result.setHours(Math.max(WORK_START_HOUR, result.getHours()), result.getMinutes(), result.getSeconds(), result.getMilliseconds());
  return result.getHours() >= WORK_START_HOUR + WORK_HOURS_PER_DAY
    ? toWorkCursor(nextWorkDay(result))
    : result;
}

export async function calculateSchedule(now = new Date()): Promise<ScheduleResult[]> {
  const [ticketsFromDatabase, workLogs, timeEntries] = await Promise.all([
    prisma.ticket.findMany({
      where: { status: { notIn: EXCLUDED_STATUSES } },
      select: {
        id: true, token: true, title: true, priority: true, status: true, createdAt: true,
        dueDate: true, estimatedHours: true,
        client: { select: { name: true, email: true } },
      },
    }),
    prisma.workLog.findMany({
      select: { ticketId: true, duration: true },
    }),
    prisma.timeEntry.findMany({
      select: { ticketId: true, durationHours: true },
    }),
  ]);

  const workedHours = new Map<string, number>();
  for (const workLog of workLogs) {
    workedHours.set(workLog.ticketId, (workedHours.get(workLog.ticketId) ?? 0) + workLog.duration);
  }
  for (const timeEntry of timeEntries) {
    workedHours.set(
      timeEntry.ticketId,
      (workedHours.get(timeEntry.ticketId) ?? 0) + timeEntry.durationHours,
    );
  }

  const tickets = ticketsFromDatabase.filter((ticket) =>
    ticket.estimatedHours - (workedHours.get(ticket.id) ?? 0) > 0,
  );
  tickets.sort(compareTickets);

  const dailyLoad = new Map<string, number>();
  const allocations = new Map<string, { date: Date; plannedHours: number }[]>();
  const scheduled = new Map<string, { startDate: Date; endDate: Date; sortOrder: number }>();

  for (let sortOrder = 0; sortOrder < tickets.length; sortOrder++) {
    const ticket = tickets[sortOrder];
    const remainingHours = Math.max(0, ticket.estimatedHours - (workedHours.get(ticket.id) ?? 0));
    let remainingCents = Math.max(0, Math.round(remainingHours * HOURS_PRECISION));
    const preferredDays = getInitialDays(now, ticket);
    const candidateDays = [...preferredDays];
    let index = 0;
    const ticketDays: { date: Date; plannedHours: number }[] = [];
    // Se le ore entrano in meno giorni, usiamo i primi per lasciare liberi
    // quelli successivi. In caso contrario distribuiamo il carico fino alla scadenza.
    const targetDays = preferredDays.length
      ? Math.min(preferredDays.length, Math.max(1, Math.ceil(remainingCents / (WORK_HOURS_PER_DAY * HOURS_PRECISION))))
      : Math.max(1, Math.ceil(remainingCents / (WORK_HOURS_PER_DAY * HOURS_PRECISION)));

    while (remainingCents > 0) {
      if (index >= candidateDays.length) {
        const next = candidateDays.length ? nextWorkDay(candidateDays[candidateDays.length - 1]) : toWorkCursor(now);
        candidateDays.push(next);
      }
      const day = candidateDays[index++];
      const key = dateKey(day);
      const availableCents = Math.max(
        0,
        Math.round(WORK_HOURS_PER_DAY * HOURS_PRECISION) - (dailyLoad.get(key) ?? 0),
      );
      if (availableCents < Math.round(MIN_TICKET_HOURS_PER_DAY * HOURS_PRECISION) && remainingCents > availableCents) continue;

      const uniformCents = Math.max(
        Math.round(MIN_TICKET_HOURS_PER_DAY * HOURS_PRECISION),
        Math.round(remainingCents / Math.max(1, targetDays - ticketDays.length)),
      );
      const allocatedCents = Math.min(
        remainingCents,
        Math.round(WORK_HOURS_PER_DAY * HOURS_PRECISION),
        availableCents,
        uniformCents,
      );
      if (allocatedCents <= 0) continue;
      const hours = roundHours(allocatedCents / HOURS_PRECISION);
      ticketDays.push({ date: day, plannedHours: hours });
      dailyLoad.set(key, (dailyLoad.get(key) ?? 0) + allocatedCents);
      remainingCents -= allocatedCents;
    }

    allocations.set(ticket.id, ticketDays);
    const startDate = ticketDays.length ? addWorkHours(ticketDays[0].date, 0) : toWorkCursor(now);
    const lastDay = ticketDays[ticketDays.length - 1]?.date ?? startDate;
    const lastHours = ticketDays[ticketDays.length - 1]?.plannedHours ?? 0;
    scheduled.set(ticket.id, {
      startDate,
      endDate: addWorkHours(lastDay, lastHours),
      sortOrder,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workDay.deleteMany();
    await tx.scheduledTask.deleteMany({ where: { ticketId: { notIn: tickets.map((ticket) => ticket.id) } } });
    for (const ticket of tickets) {
      const task = scheduled.get(ticket.id);
      if (!task) continue;
      await tx.scheduledTask.upsert({
        where: { ticketId: ticket.id },
        create: { ticketId: ticket.id, ...task },
        update: task,
      });
      for (const allocation of allocations.get(ticket.id) ?? []) {
        await tx.workDay.create({
          data: {
            ticketId: ticket.id,
            date: allocation.date,
            plannedHours: allocation.plannedHours,
            overflow: (dailyLoad.get(dateKey(allocation.date)) ?? 0) > WORK_HOURS_PER_DAY * HOURS_PRECISION,
          },
        });
      }
      if (!ticket.dueDate) {
        await tx.ticket.update({ where: { id: ticket.id }, data: { dueDate: task.endDate } });
      }
    }
  });

  return tickets.map((ticket) => {
    const task = scheduled.get(ticket.id) ?? null;
    const workDays = allocations.get(ticket.id) ?? [];
    return {
      ...ticket,
      scheduledTask: task,
      workDays,
      delayed: Boolean(ticket.dueDate && task && task.endDate > ticket.dueDate),
    };
  });
}
