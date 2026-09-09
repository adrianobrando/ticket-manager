import { NextResponse } from "next/server";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { calculateSchedule } from "@/lib/scheduler";
import { sendTicketStatusChangedEmail } from "@/lib/email";
import { updateTicketSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { id } = await context.params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const input = updateTicketSchema.parse(body.data);
    const data = {
      ...input,
      ...(input.estimatedHours === null ? { estimatedHours: 0 } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
      ...(input.contractId !== undefined ? { contractId: input.contractId } : {}),
    };

    const existing = await prisma.ticket.findUnique({
      where: { id },
      select: { status: true, contractId: true },
    });
    if (!existing) {
      return jsonError("Ticket non trovato", 404);
    }

    const ticket = await prisma.$transaction(async (transaction) => {
      const updatedTicket = await transaction.ticket.update({
        where: { id },
        data,
        select: {
          id: true, title: true, token: true, status: true, priority: true,
          estimatedHours: true, dueDate: true,
          client: { select: { name: true, email: true } },
        },
      });

      if (input.contractId !== undefined && input.contractId !== existing.contractId) {
        await transaction.timeEntry.updateMany({
          where: { ticketId: id },
          data: { contractId: input.contractId },
        });
      }

      return updatedTicket;
    });

    if (data.status && data.status !== existing.status) {
      await sendTicketStatusChangedEmail({
        title: ticket.title,
        token: ticket.token,
        clientEmail: ticket.client.email,
        clientName: ticket.client.name,
        status: ticket.status,
      });
    }

    if ("status" in data || "priority" in data || "estimatedHours" in data || "contractId" in data || "dueDate" in data) {
      const scheduled = await calculateSchedule();
      return NextResponse.json(
        scheduled.find((item) => item.id === ticket.id) ?? ticket,
      );
    }

    return NextResponse.json(ticket);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { id } = await context.params;
    const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
    if (!ticket) return jsonError("Ticket non trovato", 404);
    await prisma.$transaction(async (tx) => {
      await tx.comment.deleteMany({ where: { ticketId: id } });
      await tx.scheduledTask.deleteMany({ where: { ticketId: id } });
      await tx.ticket.delete({ where: { id } });
    });
    await calculateSchedule();
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    return handleRouteError(error);
  }
}
