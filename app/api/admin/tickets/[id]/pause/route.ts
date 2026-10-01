import { handleRouteError, jsonError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { id } = await context.params;

    const existing = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return jsonError("Ticket non trovato", 404);

    const ticket = await prisma.ticket.update({
      where: { id },
      data: { paused: true, pausedAt: new Date() },
    });

    return Response.json(ticket);
  } catch (error) {
    return handleRouteError(error);
  }
}
