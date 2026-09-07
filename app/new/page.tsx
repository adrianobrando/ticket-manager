import NewTicketForm from "./NewTicketForm";

export default function NewTicketPage() {
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY ?? "";

  return <NewTicketForm turnstileSiteKey={turnstileSiteKey} />;
}
