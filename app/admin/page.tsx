"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPriorityStyles, PriorityBadge } from "@/app/components/ui";

type Ticket = {
  id: string;
  title: string;
  token: string;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
  dueDate: string | null;
  estimatedHours: number | null;
  hourlyRate: number | null;
  fixedPrice: number | null;
  showPrice: boolean;
  client: { id: string; name: string; email: string };
  contractId: string | null;
  scheduledTask: { startDate: string; endDate: string; sortOrder: number } | null;
};
type DiaryEntry = {
  date: string;
  plannedHours: number;
  overflow: boolean;
  delayed: boolean;
  ticket: { id: string; title: string; priority: string; estimatedHours: number | null; dueDate: string | null };
};
type Contract = {
  id: string;
  name: string;
  type: string;
  hourlyRate: number;
  monthlyHoursIncluded: number | null;
  registeredHours: number;
  remainingHours: number;
  isActive: boolean;
  client: { id: string; name: string };
  tickets: { id: string; title: string; status: string }[];
};

const priorities = ["low", "normal", "high", "urgent"];
const statuses = ["new", "open", "in_progress", "completed", "cancelled"];
const priorityLabels: Record<string, string> = {
  low: "Bassa",
  normal: "Normale",
  high: "Alta",
  urgent: "Urgente",
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
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function formatHours(value: number) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function weekDays() {
  const today = new Date();
  const monday = new Date(today);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function diaryDates(start: Date) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export default function AdminPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleting, setDeleting] = useState<Ticket | null>(null);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [diaryStart, setDiaryStart] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [activeTab, setActiveTab] = useState<"tickets" | "diary" | "contracts">("tickets");
  const [contracts, setContracts] = useState<Contract[]>([]);

  async function request(path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    const response = await fetch(path, {
      ...init,
      headers,
    });
    const data = await response.json();
    if (response.status === 401) throw new Error("AUTH_REQUIRED");
    if (!response.ok) throw new Error(data.error || "Operazione non riuscita.");
    return data;
  }

  async function loadTickets(nextStatus = statusFilter, nextPriority = priorityFilter, nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (nextStatus) query.set("status", nextStatus);
      if (nextPriority) query.set("priority", nextPriority);
      query.set("page", String(nextPage));
      const result = await request(`/api/admin/tickets?${query}`);
      setTickets(result.tickets);
      setPage(result.page);
      setTotalPages(result.totalPages);
      await Promise.all([loadDiary(diaryStart), loadContracts()]);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "AUTH_REQUIRED") {
        router.replace("/admin/login");
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Accesso non riuscito.");
    } finally {
      setLoading(false);
    }

  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTickets(), 0);
    return () => window.clearTimeout(timer);
    // Initial data load should run once when the dashboard mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadContracts() {
    const result = await request("/api/admin/contracts");
    setContracts(result.contracts.filter((contract: Contract) => contract.isActive !== false));
  }

  async function loadDiary(start: Date) {
    const end = new Date(start);
    end.setDate(start.getDate() + 13);
    const result = await request(`/api/admin/diary?start=${dateKey(start)}&end=${dateKey(end)}`);
    setDiary(result.days);
  }

  async function moveDiaryWeek(offset: number) {
    const nextStart = new Date(diaryStart);
    nextStart.setDate(nextStart.getDate() + offset * 7);
    setDiaryStart(nextStart);
    setError("");
    try {
      await loadDiary(nextStart);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Diario non disponibile.");
    }
  }

  async function openDiaryTicket(ticketId: string) {
    const currentTicket = tickets.find((ticket) => ticket.id === ticketId);
    if (currentTicket) {
      setEditing(currentTicket);
      return;
    }
    try {
      const result = await request("/api/admin/tickets?page=1&pageSize=100");
      const ticket = result.tickets.find((item: Ticket) => item.id === ticketId);
      if (ticket) setEditing(ticket);
      else setError("Ticket non trovato.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossibile aprire il ticket.");
    }
  }

  async function runSchedule() {
    setMessage("");
    setError("");
    try {
      await request("/api/admin/schedule/run", { method: "POST" });
      await loadTickets();
      setMessage("Schedule ricalcolato.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Ricalcolo non riuscito.");
    }
  }

  async function saveTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    setError("");
    try {
      await request(`/api/admin/tickets/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          priority: data.get("priority"),
          status: data.get("status"),
          estimatedHours: data.get("estimatedHours") ? Number(data.get("estimatedHours")) : null,
          hourlyRate: data.get("hourlyRate") ? Number(data.get("hourlyRate")) : null,
          fixedPrice: data.get("fixedPrice") ? Number(data.get("fixedPrice")) : null,
          showPrice: data.get("showPrice") === "on",
          contractId: data.get("contractId") || null,
          dueDate: data.get("dueDate") || null,
        }),
      });
      setEditing(null);
      await loadTickets();
      setMessage("Ticket aggiornato.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Aggiornamento non riuscito.");
    }

  }

  async function deleteTicket() {
    if (!deleting) return;
    setError("");
    try {
      await request(`/api/admin/tickets/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      await loadTickets();
      setMessage("Ticket eliminato.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Eliminazione non riuscita.");
    }
  }

  const days = useMemo(() => weekDays(), []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Amministrazione</p><h1 className="text-3xl font-bold">Dashboard ticket</h1></div>
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700" href="/admin/time-entries">Registro attività</Link>
            <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700" href="/admin/contracts">Contratti</Link>
            <button className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700" onClick={() => void runSchedule()}>Ricalcola schedule</button>
          </div>
        </header>
        {message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}

        <section className="flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <select className="rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => {           const value = event.target.value; setStatusFilter(value); setPage(1); void loadTickets(value, priorityFilter, 1); }} value={statusFilter}>
            <option value="">Tutti gli stati</option>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
          <select className="rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => {           const value = event.target.value; setPriorityFilter(value); setPage(1); void loadTickets(statusFilter, value, 1); }} value={priorityFilter}>
            <option value="">Tutte le priorità</option>{priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
          </select>
        </section>

        <nav className="flex gap-2 border-b border-slate-200" aria-label="Sezioni dashboard">
          <button className={`rounded-t-lg px-4 py-3 font-semibold ${activeTab === "tickets" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-900"}`} onClick={() => setActiveTab("tickets")} type="button">Ticket</button>
          <button className={`rounded-t-lg px-4 py-3 font-semibold ${activeTab === "diary" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-900"}`} onClick={() => setActiveTab("diary")} type="button">Diario</button>
          <button className={`rounded-t-lg px-4 py-3 font-semibold ${activeTab === "contracts" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-900"}`} onClick={() => setActiveTab("contracts")} type="button">Contratti</button>
        </nav>

        {activeTab === "tickets" && <><section className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          {loading ? <p className="p-6 text-slate-500">Caricamento...</p> : (
            <table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr>{["Titolo", "Cliente", "Tipo", "Priorità", "Stato", "Tracking", "Data stimata", "Azioni"].map((heading) => <th className="px-4 py-3 font-semibold" key={heading}>{heading}</th>)}</tr></thead>
              <tbody>{tickets.map((ticket) => { const styles = getPriorityStyles(ticket.priority); return <tr className={`border-b border-l-4 border-slate-100 last:border-0 ${styles.border} ${styles.background}`} key={ticket.id}><td className="px-4 py-4 font-medium">{ticket.title}</td><td className="px-4 py-4">{ticket.client.name}<br /><span className="text-xs text-slate-600">{ticket.client.email}</span></td><td className="px-4 py-4">{ticket.type}</td><td className="px-4 py-4"><PriorityBadge priority={ticket.priority} /></td><td className="px-4 py-4">{statusLabels[ticket.status] || ticket.status}</td><td className="px-4 py-4"><code className="select-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{ticket.token}</code><br /><a className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline" href={`/t/${encodeURIComponent(ticket.token)}`} target="_blank" rel="noreferrer">Apri tracking</a></td><td className="px-4 py-4">{formatDate(ticket.dueDate)}</td><td className="flex gap-3 px-4 py-4"><button className="font-medium text-blue-700 hover:underline" onClick={() => setEditing(ticket)}>Modifica</button><button aria-label={`Elimina ${ticket.title}`} className="text-red-700 hover:text-red-900" onClick={() => setDeleting(ticket)} title="Elimina" type="button">🗑</button></td></tr>; })}</tbody>
            </table>
          )}
        </section>
        {totalPages > 1 && (
          <nav className="flex items-center justify-between rounded-2xl bg-white p-4 text-sm shadow-sm" aria-label="Paginazione ticket">
            <button className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40" disabled={page === 1} onClick={() => void loadTickets(statusFilter, priorityFilter, page - 1)} type="button">Precedente</button>
            <span>Pagina {page} di {totalPages}</span>
            <button className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40" disabled={page === totalPages} onClick={() => void loadTickets(statusFilter, priorityFilter, page + 1)} type="button">Successiva</button>
          </nav>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Calendario della settimana</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {days.map((day) => {
              const dayTickets = tickets.filter((ticket) => ticket.scheduledTask && new Date(ticket.scheduledTask.startDate).toDateString() === day.toDateString());
              return <div className="min-h-32 rounded-xl border border-slate-200 bg-slate-50 p-3" key={day.toISOString()}><h3 className="font-semibold">{new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "short" }).format(day)}</h3>{dayTickets.length === 0 ? <p className="mt-3 text-xs text-slate-500">Nessun ticket</p> : dayTickets.map((ticket) => { const styles = getPriorityStyles(ticket.priority); return <p className={`mt-3 rounded border-l-4 p-2 text-xs font-medium text-slate-900 ${styles.border} ${styles.background}`} key={ticket.id}>{ticket.title}</p>; })}</div>;
            })}
          </div>
        </section>
        </>}

        {activeTab === "diary" && <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Diario di lavoro</h2>
              <p className="mt-1 text-sm text-slate-500">Pianificazione dal {formatDate(dateKey(diaryStart))} al {formatDate(dateKey(diaryDates(diaryStart)[13]))}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => void moveDiaryWeek(-1)} type="button">← Settimana precedente</button>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => void moveDiaryWeek(1)} type="button">Settimana successiva →</button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {diaryDates(diaryStart).map((date) => {
              const entries = diary.filter((entry) => dateKey(new Date(entry.date)) === dateKey(date));
              const totalHours = entries.reduce((total, entry) => total + entry.plannedHours, 0);
              const overloaded = entries.some((entry) => entry.overflow) || totalHours > 8;
              return <div className={`min-h-40 rounded-xl border p-3 ${overloaded ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`} key={dateKey(date)}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(date)}</h3>
                  <span className={`text-xs font-semibold ${overloaded ? "text-red-700" : "text-slate-600"}`}>{formatHours(totalHours)}h / 8h</span>
                </div>
                {overloaded && <p className="mt-2 text-xs font-semibold text-red-700">⚠ Capacità giornaliera superata</p>}
                {entries.length === 0 ? <p className="mt-4 text-xs text-slate-500">Nessun ticket pianificato</p> : entries.map((entry) => {
                  const styles = getPriorityStyles(entry.ticket.priority);
                  return <button className={`mt-2 block w-full rounded border-l-4 p-2 text-left text-xs transition hover:ring-2 hover:ring-blue-300 ${styles.border} ${styles.background}`} key={`${dateKey(date)}-${entry.ticket.id}`} onClick={() => void openDiaryTicket(entry.ticket.id)} type="button">
                    <span className="flex items-center justify-between gap-2"><span className="font-semibold">{entry.ticket.title}</span><PriorityBadge priority={entry.ticket.priority} /></span>
                    <span className="mt-1 block">{formatHours(entry.plannedHours)}h pianificate{entry.ticket.estimatedHours == null ? " / quota retainer" : ` / ${formatHours(entry.ticket.estimatedHours)}h totali`}</span>
                    {entry.ticket.dueDate && <span className="mt-1 block text-slate-600">Scadenza: {formatDate(entry.ticket.dueDate)}</span>}
                    {entry.delayed && <span className="mt-1 block font-semibold text-red-700">Ritardo previsto</span>}
                  </button>;
                })}
              </div>;
            })}
          </div>
        </section>}
        {activeTab === "contracts" && <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Contratti</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">{contracts.map((contract) => { const included = contract.monthlyHoursIncluded ?? 0; const percentage = included ? Math.min(100, (contract.registeredHours / included) * 100) : 0; return <article className="rounded-xl border border-slate-200 p-4" key={contract.id}><div className="flex justify-between gap-3"><div><h3 className="font-semibold">{contract.client.name}</h3><p className="text-sm text-slate-500">{contract.name} · {contract.type === "RETAINER" ? "Retainer" : "Hourly"}</p></div><span className="text-sm font-semibold">{contract.hourlyRate.toFixed(2)} €/h</span></div>{contract.type === "RETAINER" ? <><div className="mt-4 flex justify-between text-sm"><span>{formatHours(included)}h incluse</span><span>{formatHours(contract.registeredHours)}h registrate</span><span>{formatHours(contract.remainingHours)}h rimanenti</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${contract.remainingHours < 0 ? "bg-red-500" : "bg-blue-600"}`} style={{ width: `${percentage}%` }} /></div></> : <p className="mt-4 text-sm">{formatHours(contract.registeredHours)}h registrate</p>}{contract.tickets.length > 0 && <p className="mt-3 text-xs text-slate-500">Ticket: {contract.tickets.slice(0, 3).map((ticket) => ticket.title).join(", ")}</p>}<Link className="mt-4 inline-block text-sm font-semibold text-blue-700" href={`/admin/reports?contractId=${contract.id}`}>Report</Link></article>; })}</div>
          {contracts.length === 0 && <p className="mt-4 text-sm text-slate-500">Nessun contratto attivo.</p>}
        </section>}
        {editing && <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 px-4"><form className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl" onSubmit={saveTicket}><div className="flex justify-between"><h2 className="text-xl font-semibold">Modifica ticket</h2><button onClick={() => setEditing(null)} type="button">✕</button></div><p className="font-medium">{editing.title}</p><label className="block text-sm font-medium">Priorità<select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.priority} name="priority">{priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label><label className="block text-sm font-medium">Stato<select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.status} name="status">{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label><label className="block text-sm font-medium">Ore previste<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.estimatedHours ?? ""} min="0" name="estimatedHours" step="0.5" type="number" /></label><label className="block text-sm font-medium">Tariffa oraria (€)<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.hourlyRate ?? ""} min="0" name="hourlyRate" step="1" type="number" /></label><label className="block text-sm font-medium">Prezzo preventivo fisso (€)<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.fixedPrice ?? ""} min="0" name="fixedPrice" step="0.01" type="number" /></label><label className="flex items-center gap-2 text-sm font-medium"><input defaultChecked={editing.showPrice} name="showPrice" type="checkbox" />Mostra prezzo nel tracking</label><label className="block text-sm font-medium">Contratto<select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.contractId ?? (contracts.filter((contract) => contract.client.id === editing.client.id).length === 1 ? contracts.find((contract) => contract.client.id === editing.client.id)?.id : "")} name="contractId"><option value="">Nessun contratto</option>{contracts.filter((contract) => contract.client.id === editing.client.id).map((contract) => <option key={contract.id} value={contract.id}>{contract.name} ({contract.type})</option>)}</select></label><label className="block text-sm font-medium">Data di scadenza<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.dueDate ? editing.dueDate.slice(0, 10) : ""} name="dueDate" type="date" /></label><div className="flex justify-end gap-3"><button className="rounded-lg border border-slate-300 px-4 py-2" onClick={() => setEditing(null)} type="button">Annulla</button><button className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white" type="submit">Salva</button></div></form></div>}
        {deleting && <div aria-labelledby="delete-title" aria-modal="true" className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4" role="dialog"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-semibold" id="delete-title">Eliminare il ticket?</h2><p className="mt-3 text-slate-600">Stai per eliminare definitivamente <strong>{deleting.title}</strong> e i dati associati.</p><div className="mt-6 flex justify-end gap-3"><button className="rounded-lg border border-slate-300 px-4 py-2" onClick={() => setDeleting(null)} type="button">Annulla</button><button className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700" onClick={() => void deleteTicket()} type="button">Elimina</button></div></div></div>}
      </div>
    </main>
  );
}
