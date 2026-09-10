"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/app/components/ui";

type Ticket = {
  id: string;
  title: string;
  status: string;
  client: { name: string };
};

type WorkLog = {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  notes: string | null;
  ticket: { title: string; client: { name: string } };
};

function todayKey() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function currentTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatHours(value: number) {
  return `${(Math.round(value * 100) / 100).toFixed(2)} h`;
}

export default function WorkLogPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [worklogs, setWorklogs] = useState<WorkLog[]>([]);
  const [date, setDate] = useState(todayKey);
  const [startTime, setStartTime] = useState(currentTime);
  const [endTime, setEndTime] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  async function loadData(selectedDate = date) {
    setError("");
    try {
      const [ticketResult, worklogResult] = await Promise.all([
        request("/api/admin/tickets?page=1&pageSize=100"),
        request(`/api/admin/worklogs?start=${selectedDate}&end=${selectedDate}`),
      ]);
      setTickets(ticketResult.tickets.filter((ticket: Ticket) => !["completed", "cancelled"].includes(ticket.status)));
      setWorklogs(worklogResult.worklogs);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "AUTH_REQUIRED") {
        router.replace("/admin/login");
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Accesso non riuscito.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
    // Initial data load should run once when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveWorkLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await request("/api/admin/worklogs", {
        method: "POST",
        body: JSON.stringify({
          date,
          startTime: `${date}T${startTime}:00`,
          endTime: `${date}T${endTime}:00`,
          ticketId,
          notes,
        }),
      });
      setNotes("");
      setMessage("Attività registrata.");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Registrazione non riuscita.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteWorkLog(id: string) {
    if (!window.confirm("Eliminare questa attività?")) return;
    if (isDeleting) return;
    setIsDeleting(true);
    setError("");
    try {
      await request(`/api/admin/worklogs/${id}`, { method: "DELETE" });
      setMessage("Attività eliminata.");
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Eliminazione non riuscita.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Amministrazione</p>
          <h1 className="mt-1 text-3xl font-bold">Registra attività lavorativa</h1>
        </header>
        {message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}

        <form className="space-y-5 rounded-2xl bg-white p-6 shadow-sm" onSubmit={saveWorkLog}>
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="text-sm font-medium">
              Data
              <input className={`${inputClass} mt-2`} onChange={(event) => { const value = event.target.value; setDate(value); void loadData(value); }} required type="date" value={date} />
            </label>
            <label className="text-sm font-medium">
              Ora inizio
              <input className={`${inputClass} mt-2`} onChange={(event) => setStartTime(event.target.value)} required type="time" value={startTime} />
            </label>
            <label className="text-sm font-medium">
              Ora fine
              <input className={`${inputClass} mt-2`} onChange={(event) => setEndTime(event.target.value)} required type="time" value={endTime} />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Ticket
            <select className={`${inputClass} mt-2`} onChange={(event) => setTicketId(event.target.value)} required value={ticketId}>
              <option value="">Seleziona un ticket</option>
              {tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.title} — {ticket.client.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Note <span className="font-normal text-slate-500">(opzionale)</span>
            <textarea className={`${inputClass} mt-2 min-h-24`} onChange={(event) => setNotes(event.target.value)} value={notes} />
          </label>
          <button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">
            {isSaving ? "Registrazione..." : "Registra attività"}
          </button>
        </form>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Attività del {new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`))}</h2>
            <span className="text-sm text-slate-500">{worklogs.length} registrate</span>
          </div>
          {worklogs.length === 0 ? <p className="mt-5 text-sm text-slate-500">Nessuna attività registrata per questo giorno.</p> : (
            <div className="mt-4 divide-y divide-slate-200">
              {worklogs.map((worklog) => (
                <div className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0" key={worklog.id}>
                  <div>
                    <p className="font-semibold">{formatTime(worklog.startTime)} – {formatTime(worklog.endTime)} <span className="font-normal text-slate-500">({formatHours(worklog.duration)})</span></p>
                    <p className="text-sm text-slate-700">{worklog.ticket.title} <span className="text-slate-500">· {worklog.ticket.client.name}</span></p>
                    {worklog.notes && <p className="mt-1 text-sm text-slate-500">{worklog.notes}</p>}
                  </div>
                  <button className="text-sm font-medium text-red-700 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-60" disabled={isDeleting} onClick={() => void deleteWorkLog(worklog.id)} type="button">{isDeleting ? "Eliminazione..." : "Elimina"}</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
