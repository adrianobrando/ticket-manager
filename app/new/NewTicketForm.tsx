"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { FormEvent, useState } from "react";
import { Card, FormLabel, inputClass } from "@/app/components/ui";

type CreatedTicket = {
  token: string;
  dueDate?: string | null;
};

type NewTicketFormProps = {
  turnstileSiteKey: string;
};

const requestTypes = [
  { value: "modifica sito", label: "Modifica sito" },
  { value: "nuova grafica", label: "Nuova grafica" },
  { value: "bug fix", label: "Bug fix" },
  { value: "contenuti", label: "Contenuti" },
  { value: "altro", label: "Altro" },
];

const priorities = [
  { value: "low", label: "Bassa" },
  { value: "normal", label: "Normale" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

function formatDueDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
  }).format(date);
}

export default function NewTicketForm({ turnstileSiteKey }: NewTicketFormProps) {
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!turnstileToken) {
      setError("Completa la verifica anti-spam prima di inviare la richiesta.");
      return;
    }

    setIsSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("turnstileToken", turnstileToken);

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as CreatedTicket & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Non è stato possibile creare il ticket.");
      }

      setCreatedTicket(data);
      setTurnstileToken("");
      setTurnstileKey((currentKey) => currentKey + 1);
      form.reset();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Non è stato possibile creare il ticket.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const trackingUrl = createdTicket ? `/t/${createdTicket.token}` : "";
  const dueDate = formatDueDate(createdTicket?.dueDate);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Supporto
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Invia una nuova richiesta
          </h1>
          <p className="mt-3 text-slate-600">
            Descrivi la richiesta e ti forniremo un link per seguirne lo stato.
          </p>
        </header>

        {createdTicket ? (
          <Card
            aria-live="polite"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-emerald-900">
              Ticket creato con successo
            </h2>
            <p className="mt-2 text-emerald-800">
              Puoi seguire la richiesta a questo indirizzo:
            </p>
            <a
              className="mt-3 inline-block break-all font-medium text-emerald-700 underline underline-offset-4"
              href={trackingUrl}
            >
              {trackingUrl}
            </a>
            {dueDate && (
              <p className="mt-4 text-emerald-800">
                Data stimata di completamento: <strong>{dueDate}</strong>
              </p>
            )}
            <button
              className="mt-6 rounded-lg border border-emerald-300 px-4 py-2 font-medium text-emerald-800 transition hover:bg-emerald-100"
              onClick={() => setCreatedTicket(null)}
              type="button"
            >
              Crea un altro ticket
            </button>
          </Card>
        ) : (
          <form
            className="space-y-6 rounded-2xl bg-white p-6 shadow-sm sm:p-8"
            onSubmit={handleSubmit}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <FormLabel>
                <span className="mb-2 block text-sm font-medium">Nome del cliente</span>
                <input className={inputClass} name="clientName" required type="text" />
              </FormLabel>
              <FormLabel>
                <span className="mb-2 block text-sm font-medium">Email del cliente</span>
                <input className={inputClass} name="clientEmail" required type="email" />
              </FormLabel>
            </div>

            <FormLabel>
              <span className="mb-2 block text-sm font-medium">Titolo della richiesta</span>
              <input className={inputClass} name="title" required type="text" />
            </FormLabel>

            <FormLabel>
              <span className="mb-2 block text-sm font-medium">Descrizione dettagliata</span>
              <textarea
                className="min-h-36 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                name="description"
                required
              />
            </FormLabel>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormLabel>
                <span className="mb-2 block text-sm font-medium">Tipo di richiesta</span>
                <select className={inputClass} defaultValue="" name="type" required>
                  <option disabled value="">
                    Seleziona un tipo
                  </option>
                  {requestTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </FormLabel>
              <FormLabel>
                <span className="mb-2 block text-sm font-medium">Priorità percepita</span>
                <select className={inputClass} defaultValue="normal" name="priority" required>
                  {priorities.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </FormLabel>
            </div>

<FormLabel>
  <span className="mb-2 block text-sm font-medium">
    Data di consegna desiderata{" "}
    <span className="text-xs font-normal text-slate-500">(consigliato)</span>
  </span>
  <input
    className={inputClass}
    name="dueDate"
    type="date"
    min={new Date().toISOString().split("T")[0]}
  />
  <p className="mt-1 text-xs text-slate-500">
    Se non hai una data precisa, puoi lasciare vuoto.
  </p>
</FormLabel>




            <div aria-label="Verifica anti-spam">
              {turnstileSiteKey ? (
                <Turnstile
                  key={turnstileKey}
                  onError={() => setTurnstileToken("")}
                  onExpire={() => setTurnstileToken("")}
                  onSuccess={setTurnstileToken}
                  siteKey={turnstileSiteKey}
                />
              ) : (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  Verifica anti-spam non configurata.
                </p>
              )}
            </div>

            {error && (
              <p
                aria-live="assertive"
                className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Invio in corso..." : "Invia richiesta"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
