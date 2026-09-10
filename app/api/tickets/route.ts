import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { calculateSchedule } from "@/lib/scheduler";
import { sendTicketCreatedEmail } from "@/lib/email";
import { createTicketSchema } from "@/lib/validation";

async function verifyTurnstile(token: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });

  if (!response.ok) return false;

  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const turnstileToken = formData.get("turnstileToken");
    if (typeof turnstileToken !== "string" || !turnstileToken.trim()) {
      return NextResponse.json({ error: "Verifica anti-spam fallita" }, { status: 400 });
    }

    if (!(await verifyTurnstile(turnstileToken))) {
      return NextResponse.json({ error: "Verifica anti-spam fallita" }, { status: 400 });
    }

    const input = createTicketSchema.parse(Object.fromEntries(formData.entries()));
    const { title, description, type, priority, clientName, clientEmail, estimatedHours, contractId, dueDate } = input;

    const client = await prisma.client.upsert({
      where: { email: clientEmail },
      update: { name: clientName },
      create: { email: clientEmail, name: clientName },
    });

    const contract = contractId
      ? await prisma.clientContract.findUnique({ where: { id: contractId }, select: { type: true } })
      : null;
    if (contractId && !contract) {
      return NextResponse.json({ error: "Contratto non trovato" }, { status: 404 });
    }

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        type,
        priority,
        // Production databases created before the retainer migration still
        // enforce NOT NULL. Retainer scheduling is contract-based, so zero is
        // a safe compatibility value until that migration is applied.
        estimatedHours: contract?.type === "RETAINER" ? 0 : (estimatedHours ?? 0),
        clientId: client.id,
        contractId: contractId ?? null,
        dueDate: dueDate ?? null,
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
