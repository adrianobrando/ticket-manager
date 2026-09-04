import { handleRouteError, jsonError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { calculateSchedule } from "@/lib/scheduler";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { id } = await context.params;

    const deleted = await prisma.$transaction(async (tx) => {
      const workLog = await tx.workLog.findUnique({
        where: { id },
        select: { id: true, ticketId: true, duration: true },
      });
      if (!workLog) return null;

      await tx.workLog.delete({ where: { id } });
      await tx.ticket.update({
        where: { id: workLog.ticketId },
        data: { actualHours: { decrement: workLog.duration } },
      });
      return workLog;
    });

    if (!deleted) return jsonError("Worklog non trovato", 404);
    await calculateSchedule();
    return Response.json({ deleted: true, id });
  } catch (error) {
    return handleRouteError(error);
  }
}
