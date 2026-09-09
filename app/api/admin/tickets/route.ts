import { handleRouteError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { PRIORITY_RANK } from "@/lib/scheduler";
import { ticketFiltersSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const { status, priority, page, pageSize } = ticketFiltersSchema.parse({
      status: searchParams.get("status") || undefined,
      priority: searchParams.get("priority") || undefined,
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
    });
    const where = { ...(status ? { status } : {}), ...(priority ? { priority } : {}) };

    const [tickets, total] = await prisma.$transaction([
      prisma.ticket.findMany({
      where,
      select: {
       id: true, title: true, token: true, type: true, priority: true, status: true, contractId: true,
       createdAt: true, dueDate: true, estimatedHours: true, hourlyRate: true, fixedPrice: true, showPrice: true,
       client: { select: { id: true, name: true, email: true } },
       contract: { select: { id: true, name: true, type: true, monthlyHoursIncluded: true } },
       scheduledTask: { select: { startDate: true, endDate: true, sortOrder: true } },
      },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    tickets.sort((a, b) => {
      const rankA = PRIORITY_RANK[a.priority] ?? Number.MAX_SAFE_INTEGER;
      const rankB = PRIORITY_RANK[b.priority] ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const serializedTickets = tickets.map((ticket) => ({
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      dueDate: ticket.dueDate?.toISOString() ?? null,
      scheduledTask: ticket.scheduledTask
        ? {
            ...ticket.scheduledTask,
            startDate: ticket.scheduledTask.startDate.toISOString(),
            endDate: ticket.scheduledTask.endDate.toISOString(),
          }
        : null,
    }));

    return Response.json({
      tickets: serializedTickets,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
