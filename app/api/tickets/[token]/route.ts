import { handleRouteError, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { calculateSchedule } from "@/lib/scheduler";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;

    const ticket = await prisma.ticket.findUnique({
      where: { token },
      select: {
        title: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        dueDate: true,
        fixedPrice: true,
        hourlyRate: true,
        estimatedHours: true,
        showPrice: true,
        comments: {
          select: { id: true, author: true, content: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return jsonError("Ticket non trovato", 404);
    }

    const calculatedPrice = ticket.fixedPrice ?? (
      ticket.hourlyRate != null && ticket.estimatedHours != null
        ? ticket.hourlyRate * ticket.estimatedHours
        : null
    );
    return Response.json({
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      dueDate: ticket.dueDate,
      price: ticket.showPrice ? calculatedPrice : null,
      comments: ticket.comments,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const ticket = await prisma.ticket.findUnique({
      where: { token },
      select: { id: true, status: true },
    });
    if (!ticket) return jsonError("Ticket non trovato", 404);
    if (ticket.status !== "new") {
      return jsonError("Solo i ticket nuovi possono essere eliminati", 409);
    }
    await prisma.$transaction(async (tx) => {
      await tx.comment.deleteMany({ where: { ticketId: ticket.id } });
      await tx.scheduledTask.deleteMany({ where: { ticketId: ticket.id } });
      await tx.ticket.delete({ where: { id: ticket.id } });
    });
    await calculateSchedule();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
