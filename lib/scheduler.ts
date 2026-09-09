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
  estimatedHours: number | null;
  client: { name: string; email: string };
  contract: {
    id: string;
    type: string;
    monthlyHoursIncluded: number | null;
    startDate: Date;
    endDate: Date | null;
    isActive: boolean;
  } | null;
};

export type ScheduleResult = Omit<TicketForSchedule, "contract"> & {
  scheduledTask: { startDate: Date; endDate: Date; sortOrder: number } | null;
  workDays: { date: Date; plannedHours: number }[];
  delayed: boolean;
};

type Allocation = { date: Date; plannedHours: number };

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
  do result.setDate(result.getDate() + 1);
  while (isWeekend(result));
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

export function toWorkCursor(date: Date): Date {
  const result = new Date(date);
  if (isWeekend(result)) return startOfDay(result.getDay() === 6
    ? new Date(result.setDate(result.getDate() + 2))
    : new Date(result.setDate(result.getDate() + 1)));
  result.setHours(Math.max(WORK_START_HOUR, result.getHours()), result.getMinutes(), result.getSeconds(), result.getMilliseconds());
  return result.getHours() >= WORK_START_HOUR + WORK_HOURS_PER_DAY
    ? toWorkCursor(nextWorkDay(result))
    : result;
}

function monthBounds(now: Date) {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function contractIsActiveInMonth(
  contract: NonNullable<TicketForSchedule["contract"]>,
  monthStart: Date,
  monthEnd: Date,
) {
  return contract.isActive && contract.startDate <= monthEnd
    && (!contract.endDate || contract.endDate >= monthStart);
}

function retainerWeight(ticket: TicketForSchedule, now: Date) {
  // Priority is the primary input; a near due date gives the ticket a fair
  // chance to consume more of the current month's retainer capacity.
  const priorityWeight = [4, 3, 2, 1][PRIORITY_RANK[ticket.priority] ?? 3] ?? 1;
  if (!ticket.dueDate) return priorityWeight;
  const daysToDue = (startOfDay(ticket.dueDate).getTime() - startOfDay(now).getTime()) / 86400000;
  return priorityWeight + (daysToDue <= 7 ? 2 : daysToDue <= 31 ? 1 : 0);
}

function allocateHours(
  hours: number,
  days: Date[],
  dailyLoad: Map<string, number>,
  allocations: Allocation[],
) {
  let remainingCents = Math.max(0, Math.round(hours * HOURS_PRECISION));
  for (const day of days) {
    if (remainingCents <= 0) break;
    const key = dateKey(day);
    const availableCents = Math.max(0, Math.round(WORK_HOURS_PER_DAY * HOURS_PRECISION) - (dailyLoad.get(key) ?? 0));
    const allocatedCents = Math.min(
      remainingCents,
      availableCents,
      Math.round(MAX_TICKET_HOURS_PER_DAY * HOURS_PRECISION),
    );
    if (allocatedCents <= 0) continue;
    dailyLoad.set(key, (dailyLoad.get(key) ?? 0) + allocatedCents);
    allocations.push({ date: day, plannedHours: roundHours(allocatedCents / HOURS_PRECISION) });
    remainingCents -= allocatedCents;
  }
  return remainingCents;
}

export async function calculateSchedule(now = new Date()): Promise<ScheduleResult[]> {
  const [ticketsFromDatabase, workLogs, timeEntries] = await Promise.all([
    prisma.ticket.findMany({
      where: { status: { notIn: EXCLUDED_STATUSES } },
      select: {
        id: true, token: true, title: true, priority: true, status: true, createdAt: true,
        dueDate: true, estimatedHours: true,
        client: { select: { name: true, email: true } },
        contract: {
          select: { id: true, type: true, monthlyHoursIncluded: true, startDate: true, endDate: true, isActive: true },
        },
      },
    }),
    prisma.workLog.findMany({ select: { ticketId: true, date: true, duration: true } }),
    prisma.timeEntry.findMany({
      select: { ticketId: true, contractId: true, date: true, durationHours: true },
    }),
  ]);

  const workedHours = new Map<string, number>();
  for (const entry of workLogs) {
    workedHours.set(entry.ticketId, (workedHours.get(entry.ticketId) ?? 0) + entry.duration);
  }
  for (const entry of timeEntries) {
    workedHours.set(entry.ticketId, (workedHours.get(entry.ticketId) ?? 0) + entry.durationHours);
  }

  const { start: monthStart, end: monthEnd } = monthBounds(now);
  const dailyLoad = new Map<string, number>();
  const allocations = new Map<string, Allocation[]>();
  const overflowTickets = new Set<string>();
  const scheduled = new Map<string, { startDate: Date; endDate: Date; sortOrder: number }>();
  const tickets = ticketsFromDatabase as TicketForSchedule[];
  const scheduledTickets: TicketForSchedule[] = [];

  // Hourly contracts retain the old finite-estimate behavior.
  const hourlyTickets = tickets.filter((ticket) => ticket.contract?.type !== "RETAINER"
    && (ticket.estimatedHours ?? 0) - (workedHours.get(ticket.id) ?? 0) > 0);
  hourlyTickets.sort(compareTickets);
  for (const ticket of hourlyTickets) {
    const remaining = Math.max(0, (ticket.estimatedHours ?? 0) - (workedHours.get(ticket.id) ?? 0));
    const end = ticket.dueDate ?? new Date(now.getTime() + Math.max(1, Math.ceil(remaining / WORK_HOURS_PER_DAY)) * 86400000);
    const days = workDaysBetween(now, end);
    const ticketAllocations: Allocation[] = [];
    let overflowCents = allocateHours(remaining, days, dailyLoad, ticketAllocations);
    while (overflowCents > 0) {
      const next = days.length ? nextWorkDay(days[days.length - 1]) : toWorkCursor(now);
      days.push(next);
      overflowCents = allocateHours(overflowCents / HOURS_PRECISION, [next], dailyLoad, ticketAllocations);
    }
    allocations.set(ticket.id, ticketAllocations);
    scheduledTickets.push(ticket);
  }

  const retainerTickets = tickets.filter((ticket) =>
    ticket.contract?.type === "RETAINER"
    && contractIsActiveInMonth(ticket.contract, monthStart, monthEnd),
  );
  const ticketsByContract = new Map<string, TicketForSchedule[]>();
  for (const ticket of retainerTickets) {
    const contractId = ticket.contract!.id;
    ticketsByContract.set(contractId, [...(ticketsByContract.get(contractId) ?? []), ticket]);
  }

  for (const contractTickets of ticketsByContract.values()) {
    const contract = contractTickets[0].contract!;
    const usedThisMonth = [...timeEntries, ...workLogs]
      .filter((entry) => {
        const ticket = contractTickets.find((candidate) => candidate.id === entry.ticketId);
        return ticket && entry.date >= monthStart && entry.date <= monthEnd;
      })
      .reduce((sum, entry) => sum + ("durationHours" in entry ? entry.durationHours : entry.duration), 0);
    const availableHours = Math.max(0, (contract.monthlyHoursIncluded ?? 0) - usedThisMonth);
    const ordered = [...contractTickets].sort(compareTickets);
    const totalWeight = ordered.reduce((sum, ticket) => sum + retainerWeight(ticket, now), 0);
    let remainingCents = Math.round(availableHours * HOURS_PRECISION);

    for (let index = 0; index < ordered.length; index++) {
      const ticket = ordered[index];
      const quotaCents = index === ordered.length - 1
        ? remainingCents
        : Math.floor((remainingCents * retainerWeight(ticket, now)) / totalWeight);
      remainingCents -= quotaCents;
      const due = ticket.dueDate && ticket.dueDate < monthEnd ? ticket.dueDate : monthEnd;
      const days = workDaysBetween(now > monthStart ? now : monthStart, due);
      const ticketAllocations: Allocation[] = [];
      const unallocatedCents = allocateHours(quotaCents / HOURS_PRECISION, days, dailyLoad, ticketAllocations);
      if (unallocatedCents > 0) overflowTickets.add(ticket.id);
      allocations.set(ticket.id, ticketAllocations);
      scheduledTickets.push(ticket);
    }
  }

  for (let sortOrder = 0; sortOrder < scheduledTickets.length; sortOrder++) {
    const ticket = scheduledTickets[sortOrder];
    const ticketDays = allocations.get(ticket.id) ?? [];
    const startDate = ticketDays.length ? addWorkHours(ticketDays[0].date, 0) : toWorkCursor(now);
    const lastDay = ticketDays[ticketDays.length - 1]?.date ?? startDate;
    const lastHours = ticketDays[ticketDays.length - 1]?.plannedHours ?? 0;
    scheduled.set(ticket.id, { startDate, endDate: addWorkHours(lastDay, lastHours), sortOrder });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workDay.deleteMany();
    await tx.scheduledTask.deleteMany({ where: { ticketId: { notIn: scheduledTickets.map((ticket) => ticket.id) } } });
    for (const ticket of scheduledTickets) {
      const task = scheduled.get(ticket.id);
      if (!task) continue;
      await tx.scheduledTask.upsert({ where: { ticketId: ticket.id }, create: { ticketId: ticket.id, ...task }, update: task });
      for (const allocation of allocations.get(ticket.id) ?? []) {
        await tx.workDay.create({
          data: {
            ticketId: ticket.id,
            date: allocation.date,
            plannedHours: allocation.plannedHours,
            overflow: overflowTickets.has(ticket.id),
          },
        });
      }
      if (!ticket.dueDate && ticket.contract?.type !== "RETAINER") {
        await tx.ticket.update({ where: { id: ticket.id }, data: { dueDate: task.endDate } });
      }
    }
  });

  return scheduledTickets.map((ticket) => {
    const task = scheduled.get(ticket.id) ?? null;
    return {
      ...ticket,
      scheduledTask: task,
      workDays: allocations.get(ticket.id) ?? [],
      delayed: Boolean(ticket.dueDate && task && task.endDate > ticket.dueDate),
    };
  });
}
