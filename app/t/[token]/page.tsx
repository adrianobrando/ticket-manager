"use client";

import { FormEvent, use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, FormLabel, getPriorityStyles, inputClass, PriorityBadge } from "@/app/components/ui";

type Comment = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
};

type Ticket = {
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  dueDate: string | null;
  comments: Comment[];
};

type ApiError = {
  error?: string;
};

const statusLabels: Record<string, string> = {
  new: "Nuovo",
  open: "Aperto",
  in_progress: "In lavorazione",
  completed: "Completato",
  cancelled: "Annullato",
};

function formatDate(value: string | null) {
  if (!value) return "Non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non disponibile";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export default function TicketTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTicket() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/tickets/${encodeURIComponent(token)}`);
        const data = (await response.json()) as Ticket & ApiError;

        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!response.ok) {
          throw new Error(data.error || "Impossibile recuperare il ticket.");
        }
        if (!cancelled) setTicket(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossibile recuperare il ticket.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTicket();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentError("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch(
        `/api/tickets/${encodeURIComponent(token)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: formData.get("content"),
            authorType: formData.get("authorType"),
          }),
        },
      );
      const data = (await response.json()) as Comment & ApiError;

      if (!response.ok) {
        throw new Error(data.error || "Impossibile aggiungere il commento.");
      }

      setTicket((current) =>
        current ? { ...current, comments: [...current.comments, data] } : current,
      );
      form.reset();
    } catch (submissionError) {
      setCommentError(
        submissionError instanceof Error
          ? submissionError.message
          : "Impossibile aggiungere il commento.",
      );
    } finally {
      setIsSubmitting(false);
    }

  }

  async function deleteTicket() {
    setDeleteError("");
    try {
      const response = await fetch(`/api/tickets/${encodeURIComponent(token)}`, { method: "DELETE" });
      const data = (await response.json()) as ApiError;
      if (!response.ok) throw new Error(data.error || "Impossibile eliminare la richiesta.");
      setShowDeleteModal(false);
      setDeleted(true);
    } catch (deletionError) {
      setDeleteError(deletionError instanceof Error ? deletionError.message : "Impossibile eliminare la richiesta.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-600">
        Caricamento ticket...
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <section className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Ticket non trovato</h1>
          <p className="mt-3 text-slate-600">
            Il token di tracking non è valido o il ticket non esiste.
          </p>
        </section>
      </main>
    );
  }

  if (deleted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <section className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Richiesta eliminata</h1>
          <p className="mt-3 text-slate-600">Il ticket e i dati associati sono stati eliminati.</p>
          <Link className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white" href="/">Torna alla home</Link>
        </section>
      </main>
    );
  }

  if (error || !ticket) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <section className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Si è verificato un errore</h1>
          <p className="mt-3 text-red-600">{error || "Ticket non disponibile."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className={`border-l-4 p-6 sm:p-8 ${getPriorityStyles(ticket.priority).border} ${getPriorityStyles(ticket.priority).background}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                Tracking ticket
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{ticket.title}</h1>
            </div>
            <Badge className="bg-blue-100 text-blue-800">
              {statusLabels[ticket.status] || ticket.status}
            </Badge>
          </div>

          <p className="mt-6 whitespace-pre-wrap text-slate-700">{ticket.description}</p>

          <dl className="mt-8 grid gap-5 border-t border-slate-200 pt-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500">Priorità</dt>
              <dd className="mt-1"><PriorityBadge priority={ticket.priority} /></dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Data di creazione</dt>
              <dd className="mt-1 font-medium">{formatDate(ticket.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Completamento stimato</dt>
              <dd className="mt-1 font-medium">{formatDate(ticket.dueDate)}</dd>
            </div>
          </dl>
          {ticket.status === "new" && (
            <button className="mt-8 rounded-lg border border-red-200 px-4 py-2 font-medium text-red-700 hover:bg-red-50" onClick={() => setShowDeleteModal(true)} type="button">
              Elimina richiesta
            </button>
          )}
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Commenti</h2>
          {ticket.comments.length === 0 ? (
            <p className="mt-4 text-slate-500">Non ci sono ancora commenti.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {ticket.comments.map((comment) => (
                <article key={comment.id} className={`rounded-xl border-l-4 p-4 ${getPriorityStyles(ticket.priority).border} ${getPriorityStyles(ticket.priority).background}`}>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <strong>{comment.author === "admin" ? "Admin" : "Cliente"}</strong>
                    <time className="text-slate-500">{formatDate(comment.createdAt)}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-slate-700">
                    {comment.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Aggiungi un commento</h2>
          <form className="mt-5 space-y-4" onSubmit={handleCommentSubmit}>
            <FormLabel>
              <span className="mb-2 block text-sm font-medium">Autore</span>
              <select
                className={inputClass}
                defaultValue="client"
                name="authorType"
              >
                <option value="client">Cliente</option>
                <option value="admin">Admin</option>
              </select>
            </FormLabel>
            <FormLabel>
              <span className="mb-2 block text-sm font-medium">Commento</span>
              <textarea
                className="min-h-28 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                name="content"
                required
              />
            </FormLabel>
            {commentError && (
              <p aria-live="assertive" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {commentError}
              </p>
            )}
            <button
              className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Invio in corso..." : "Aggiungi commento"}
            </button>
          </form>
        </Card>
        {showDeleteModal && <div aria-modal="true" className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4" role="dialog"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-semibold">Eliminare la richiesta?</h2><p className="mt-3 text-slate-600">Questa azione eliminerà definitivamente il ticket e i commenti associati.</p>{deleteError && <p className="mt-4 text-sm text-red-600">{deleteError}</p>}<div className="mt-6 flex justify-end gap-3"><button className="rounded-lg border border-slate-300 px-4 py-2" onClick={() => setShowDeleteModal(false)} type="button">Annulla</button><button className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700" onClick={() => void deleteTicket()} type="button">Elimina</button></div></div></div>}
      </div>
    </main>
  );
}
