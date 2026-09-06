import { Resend } from "resend";

type TicketEmail = {
  title: string;
  token: string;
  clientEmail: string;
  clientName: string;
  status?: string;
};

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY non configurata");
  return new Resend(apiKey);
}

function getFromAddress() {
  return process.env.RESEND_FROM || "Ticket Manager <onboarding@resend.dev>";
}

function trackingUrl(token: string) {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/t/${encodeURIComponent(token)}`;
}

export async function sendTicketCreatedEmail(ticket: TicketEmail) {
  const resend = getResend();
  const url = trackingUrl(ticket.token);

  await resend.emails.send({
    from: getFromAddress(),
    to: ticket.clientEmail,
    subject: `Richiesta ricevuta: ${ticket.title}`,
    text: `Ciao ${ticket.clientName}, abbiamo ricevuto la tua richiesta "${ticket.title}". Seguila qui: ${url}`,
    html: `<p>Ciao ${ticket.clientName},</p><p>abbiamo ricevuto la tua richiesta <strong>${ticket.title}</strong>.</p><p><a href="${url}">Segui il ticket</a></p>`,
  });
}

export async function sendTicketStatusChangedEmail(ticket: TicketEmail & { status: string }) {
  const resend = getResend();
  const url = trackingUrl(ticket.token);

  await resend.emails.send({
    from: getFromAddress(),
    to: ticket.clientEmail,
    subject: `Aggiornamento ticket: ${ticket.title}`,
    text: `Lo stato del ticket "${ticket.title}" è ora "${ticket.status}". Seguilo qui: ${url}`,
    html: `<p>Lo stato del ticket <strong>${ticket.title}</strong> è ora <strong>${ticket.status}</strong>.</p><p><a href="${url}">Visualizza aggiornamento</a></p>`,
  });
}
