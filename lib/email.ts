import nodemailer from "nodemailer";

type TicketEmail = {
  title: string;
  token: string;
  clientEmail: string;
  clientName: string;
  status?: string;
};

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;

  if (!host || !Number.isInteger(port) || port <= 0 || !from) {
    throw new Error(
      "Configurazione SMTP incompleta: servono SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS ed EMAIL_FROM",
    );
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      ...(user && pass ? { auth: { user, pass } } : {}),
    }),
    from,
  };
}

function trackingUrl(token: string) {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/t/${encodeURIComponent(token)}`;
}

export async function sendTicketCreatedEmail(ticket: TicketEmail) {
  const { transporter, from } = getTransporter();
  const url = trackingUrl(ticket.token);

  await transporter.sendMail({
    from,
    to: ticket.clientEmail,
    subject: `Richiesta ricevuta: ${ticket.title}`,
    text: `Ciao ${ticket.clientName}, abbiamo ricevuto la tua richiesta "${ticket.title}". Seguila qui: ${url}`,
    html: `<p>Ciao ${ticket.clientName},</p><p>abbiamo ricevuto la tua richiesta <strong>${ticket.title}</strong>.</p><p><a href="${url}">Segui il ticket</a></p>`,
  });
}

export async function sendTicketStatusChangedEmail(ticket: TicketEmail & { status: string }) {
  const { transporter, from } = getTransporter();
  const url = trackingUrl(ticket.token);

  await transporter.sendMail({
    from,
    to: ticket.clientEmail,
    subject: `Aggiornamento ticket: ${ticket.title}`,
    text: `Lo stato del ticket "${ticket.title}" è ora "${ticket.status}". Seguilo qui: ${url}`,
    html: `<p>Lo stato del ticket <strong>${ticket.title}</strong> è ora <strong>${ticket.status}</strong>.</p><p><a href="${url}">Visualizza aggiornamento</a></p>`,
  });
}
