import { NextResponse } from "next/server";
import { handleRouteError, readJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { calculateSchedule } from "@/lib/scheduler";
import { sendTicketCreatedEmail } from "@/lib/email";
import { createTicketSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const input = createTicketSchema.parse(body.data);
    const { title, description, type, priority, clientName, clientEmail, estimatedHours, contractId } = input;

    const client = await prisma.client.upsert({
      where: { email: clientEmail },
      update: { name: clientName },
      create: { email: clientEmail, name: clientName },
    });

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        type,
        priority,
        estimatedHours,
        clientId: client.id,
        contractId: contractId ?? null,
      },
      select: { id: true, title: true, token: true, client: { select: { name: true, email: true } } },
    });

    const scheduled = await calculateSchedule();
    const ticketWithSchedule =
      scheduled.find((item) => item.id === ticket.id) ?? ticket;
    try {
      await sendTicketCreatedEmail({
        title: ticketWithSchedule.title,
        token: ticketWithSchedule.token,
        clientEmail: ticket.client.email,
        clientName: ticket.client.name,
      });
    } catch (emailError) {
      console.error("Errore invio email Resend, ma il ticket è stato creato:", emailError);
    }

    return NextResponse.json(ticketWithSchedule, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
