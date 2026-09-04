"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/app/components/ui";

type Ticket = { id: string; title: string; status: string; client: { name: string } };
type Entry = {
  id: string;
  ticketId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  note: string | null;
  ticket: { title: string; client: { name: string } };
};

const dateKey = (date = new Date()) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

function formatTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function TimeEntriesPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [date, setDate] = useState(dateKey());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    const data = await response.json();
    if (response.status === 401) throw new Error("AUTH_REQUIRED");
    if (!response.ok) throw new Error(data.error || "Operazione non riuscita.");
    return data;
  }

  async function load(selectedDate = date) {
    try {
      const [ticketResult, entryResult] = await Promise.all([
        request("/api/admin/tickets?page=1&pageSize=100"),
        request(`/api/admin/time-entries?from=${selectedDate}&to=${selectedDate}`),
      ]);
      setTickets(ticketResult.tickets);
      setEntries(entryResult.timeEntries);
      setError("");
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "AUTH_REQUIRED") {
        router.replace("/admin/login");
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Accesso non riuscito.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // Initial data load should run once when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const durationHours = Number(((new Date(`${date}T${endTime}:00`).getTime() - new Date(`${date}T${startTime}:00`).getTime()) / 3_600_000).toFixed(2));
      if (durationHours <= 0) {
        throw new Error("L'ora fine deve essere successiva all'ora di inizio.");
      }
      await request(editing ? `/api/admin/time-entries/${editing.id}` : "/api/admin/time-entries", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ ticketId, date, startTime: `${date}T${startTime}:00`, endTime: `${date}T${endTime}:00`, durationHours, note }),
      });
      setTicketId("");
      setStartTime("");
      setEndTime("");
      setNote("");
      setEditing(null);
      setMessage(editing ? "Attività aggiornata." : "Ore registrate.");
      await load();
      setShowForm(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Registrazione non riuscita.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Eliminare questa registrazione?")) return;
    try {
      await request(`/api/admin/time-entries/${id}`, { method: "DELETE" });
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Eliminazione non riuscita.");
    }
  }

  const total = entries.reduce((sum, entry) => sum + entry.durationHours, 0);
  return <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6"><div className="mx-auto max-w-4xl space-y-6"><header><p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Amministrazione</p><h1 className="mt-1 text-3xl font-bold">Registro attività</h1></header>{message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">{message}</p>}{error && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}<button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white" onClick={() => { setEditing(null); setShowForm(true); setMessage(""); setError(""); }} type="button">Nuova attività</button>{showForm && <form className="grid gap-4 rounded-2xl bg-white p-6 sm:grid-cols-2" onSubmit={save}><label className="text-sm font-medium">Ticket<select className={`${inputClass} mt-2`} onChange={(event) => setTicketId(event.target.value)} required value={ticketId}><option value="">Seleziona ticket</option>{tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.title} — {ticket.client.name}</option>)}</select></label><label className="text-sm font-medium">Data<input className={`${inputClass} mt-2`} onChange={(event) => { const value = event.target.value; setDate(value); void load(value); }} required type="date" value={date} /></label><label className="text-sm font-medium">Ora inizio<input className={`${inputClass} mt-2`} onChange={(event) => setStartTime(event.target.value)} required type="time" value={startTime} /></label><label className="text-sm font-medium">Ora fine<input className={`${inputClass} mt-2`} onChange={(event) => setEndTime(event.target.value)} required type="time" value={endTime} /></label><label className="text-sm font-medium sm:col-span-2">Nota<textarea className={`${inputClass} mt-2`} onChange={(event) => setNote(event.target.value)} value={note} /></label><div className="flex gap-3 sm:col-span-2"><button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white" type="submit">{editing ? "Salva modifiche" : "Registra ore"}</button><button className="rounded-lg border border-slate-300 px-5 py-3 font-semibold" onClick={() => { setEditing(null); setShowForm(false); }} type="button">Annulla</button></div></form>}<section className="rounded-2xl bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Attività del giorno</h2><strong>{total.toFixed(2)} h totali</strong></div><div className="mt-4 divide-y divide-slate-200">{entries.length === 0 ? <p className="text-sm text-slate-500">Nessuna attività.</p> : entries.map((entry) => <div className="flex flex-wrap justify-between gap-3 py-4 first:pt-0" key={entry.id}><div><p className="font-semibold">{formatTime(entry.startTime)} – {formatTime(entry.endTime)} · {entry.durationHours.toFixed(2)} h</p><p className="text-sm">{entry.ticket.title} <span className="text-slate-500">· {entry.ticket.client.name}</span></p>{entry.note && <p className="text-sm text-slate-500">{entry.note}</p>}</div><div className="flex gap-3"><button className="text-sm font-medium text-blue-700" onClick={() => { setEditing(entry); setTicketId(entry.ticketId ?? ""); setDate(entry.date.slice(0, 10)); setStartTime(entry.startTime.slice(11, 16)); setEndTime(entry.endTime.slice(11, 16)); setNote(entry.note ?? ""); setShowForm(true); }} type="button">Modifica</button><button className="text-sm font-medium text-red-700" onClick={() => void remove(entry.id)} type="button">Elimina</button></div></div>)}</div></section></div></main>;
}
