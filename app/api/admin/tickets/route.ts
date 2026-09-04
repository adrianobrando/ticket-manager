import { handleRouteError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { PRIORITY_RANK } from "@/lib/scheduler";
import { ticketFiltersSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const headers = new Headers(request.headers);
    if (!headers.get("x-admin-password")) {
      const cookiePassword = request.headers
        .get("cookie")
        ?.split(";")
        .map((cookie) => cookie.trim().split("="))
        .find(([name]) => name === "admin-password")?.[1];
      if (cookiePassword) headers.set("x-admin-password", decodeURIComponent(cookiePassword));
    }
    const authError = requireAdminPassword(new Request(request, { headers }));
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
       id: true, title: true, type: true, priority: true, status: true, contractId: true,
       createdAt: true, dueDate: true, estimatedHours: true,
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

    return Response.json({ tickets, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return handleRouteError(error);
  }
}
