"use client";

import { FormEvent, useEffect, useState } from "react";
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
  oreStimate: number | null;
  hourlyRate: number | null;
  fixedPrice: number | null;
  showPrice: boolean;
  client: { id: string; name: string; email: string };
  contractId: string | null;
  contract: { type: string } | null;
  paused: boolean;
  pausedAt: string | null;
  scheduledTask: { startDate: string; endDate: string; sortOrder: number } | null;
};
type DiaryEntry = {
  date: string;
  plannedHours: number;
  overflow: boolean;
  delayed: boolean;
  ticket: { id: string; title: string; priority: string; oreStimate: number | null; dueDate: string | null };
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
type TodayData = {
  data: string;
  orePianificateOggi: number;
  oreLibere: number;
  ticketsOggi: {
    id: string;
    title: string;
    clientName: string;
    priority: string;
    orePianificateOggi: number;
    dueDate: string | null;
    inRitardo: boolean;
  }[];
  ticketsInPausa: { id: string; title: string; clientName: string; pausedAt: string | null }[];
  totaleInRitardo: number;
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
const todayPriorityBorders: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  normal: "border-l-yellow-500",
  low: "border-l-emerald-500",
};

function formatDate(value: string | null) {
  if (!value) return "Non disponibile";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function formatHours(value: number) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function formatDuration(value: number) {
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return minutes ? `${minutes}m` : "0h";
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showPaused, setShowPaused] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [formErrors, setFormErrors] = useState<{ oreStimate?: string; dueDate?: string }>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [, setPendingSaveData] = useState<FormData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleting, setDeleting] = useState<Ticket | null>(null);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [pausedTickets, setPausedTickets] = useState<Ticket[]>([]);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [diaryStart, setDiaryStart] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [diaryDaysToShow, setDiaryDaysToShow] = useState(3);
  const [activeTab, setActiveTab] = useState<"oggi" | "tickets" | "diary" | "contracts">("oggi");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [isLoadingToday, setIsLoadingToday] = useState(false);
  const [heatmapData, setHeatmapData] = useState<{date: string, plannedHours: number, ticketCount: number}[] | null>(null);
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);

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

  async function loadTickets(nextStatus = statusFilter, nextPriority = priorityFilter, nextPage = page, nextIncludePaused = showPaused) {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (nextStatus) query.set("status", nextStatus);
      if (nextPriority) query.set("priority", nextPriority);
      if (nextIncludePaused) query.set("includePaused", "true");
      query.set("page", String(nextPage));
      const result = await request(`/api/admin/tickets?${query}`);
      setTickets(result.tickets);
      setPage(result.page);
      setTotalPages(result.totalPages);
      await Promise.all([loadDiary(diaryStart), loadContracts(), loadPausedTickets()]);
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
    void loadTodayData();
    void loadHeatmapData();
    return () => window.clearTimeout(timer);
    // Initial data load should run once when the dashboard mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadContracts() {
    const result = await request("/api/admin/contracts");
    setContracts(result.contracts.filter((contract: Contract) => contract.isActive !== false));
  }

  async function loadPausedTickets() {
    const result = await request("/api/admin/tickets?onlyPaused=true");
    setPausedTickets(result.tickets);
  }

  async function loadTodayData() {
    setIsLoadingToday(true);
    setError("");
    try {
      const result = await request("/api/admin/today");
      setTodayData(result);
    } catch (todayError) {
      if (todayError instanceof Error && todayError.message === "AUTH_REQUIRED") {
        router.replace("/admin/login");
      } else {
        setError(todayError instanceof Error ? todayError.message : "Impossibile caricare la giornata.");
      }
    } finally {
      setIsLoadingToday(false);
    }
  }

  async function loadHeatmapData() {
    setIsLoadingHeatmap(true);
    setError("");
    try {
      const result = await request("/api/admin/heatmap");
      setHeatmapData(result);
    } catch (heatmapError) {
      if (heatmapError instanceof Error && heatmapError.message === "AUTH_REQUIRED") {
        router.replace("/admin/login");
      } else {
        setError(heatmapError instanceof Error ? heatmapError.message : "Impossibile caricare la heatmap.");
      }
    } finally {
      setIsLoadingHeatmap(false);
    }
  }

  async function resumeTicket(ticketId: string) {
    if (resumingId) return;
    setResumingId(ticketId);
    setError("");
    try {
      await request(`/api/admin/tickets/${ticketId}/resume`, { method: "POST" });
      setPausedTickets((current) => current.filter((ticket) => ticket.id !== ticketId));
      await loadTickets();
      setMessage("Ticket ripreso.");
    } catch (resumeError) {
      setError(resumeError instanceof Error ? resumeError.message : "Operazione non riuscita.");
    } finally {
      setResumingId(null);
    }
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
      setFormErrors({});
      setEditing(currentTicket);
      return;
    }
    try {
      const result = await request("/api/admin/tickets?page=1&pageSize=100");
      const ticket = result.tickets.find((item: Ticket) => item.id === ticketId);
      if (ticket) {
        setFormErrors({});
        setEditing(ticket);
      }
      else setError("Ticket non trovato.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossibile aprire il ticket.");
    }
  }

  async function openTicketFromToday(id: string) {
    const currentTicket = tickets.find((ticket) => ticket.id === id);
    if (currentTicket) {
      setFormErrors({});
      setEditing(currentTicket);
      return;
    }

    try {
      const fullTicket: Ticket = await request("/api/admin/tickets/" + id);
      setFormErrors({});
      setEditing(fullTicket);
    } catch (openError) {
      if (openError instanceof Error && openError.message === "AUTH_REQUIRED") {
        router.replace("/admin/login");
        return;
      }
      setError(openError instanceof Error ? openError.message : "Impossibile aprire il ticket.");
    }
  }

  async function runSchedule() {
    if (isRunning) return;
    setIsRunning(true);
    setMessage("");
    setError("");
    try {
      await request("/api/admin/schedule/run", { method: "POST" });
      await loadTickets();
      await Promise.all([loadTodayData(), loadHeatmapData()]);
      setMessage("Schedule ricalcolato.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Ricalcolo non riuscito.");
    } finally {
      setIsRunning(false);
    }
  }

  async function saveTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (isSaving) return;
    const data = new FormData(event.currentTarget);
    const selectedContractId = data.get("contractId");
    const isRetainer = contracts.some(
      (contract) => contract.id === selectedContractId && contract.type === "RETAINER",
    );

    if (!isRetainer) {
      const oreStimate = Number(data.get("oreStimate"));
      if (!Number.isFinite(oreStimate) || oreStimate <= 0) {
        setFormErrors({ oreStimate: "Inserisci le ore previste (maggiori di zero)" });
        return;
      }
      if (!data.get("dueDate")) {
        setFormErrors({ dueDate: "Inserisci la data di consegna" });
        return;
      }

      setIsSaving(true);
      try {
        const check: { canFit: boolean; oreMancanti?: number; giorniDiRitardo?: number } = await request(
          `/api/admin/tickets/${editing.id}/check-capacity`,
          { method: "POST", body: JSON.stringify({ dueDate: data.get("dueDate"), oreStimate }) },
        );
        if (!check.canFit) {
          setPendingSaveData(data);
          const confirmed = window.confirm(
            `Attenzione: la scadenza non è realistica. Ti servono ${check.oreMancanti} ore in più ` +
              `(giorni di ritardo stimati: ${check.giorniDiRitardo}). Vuoi salvare comunque?`,
          );
          if (!confirmed) {
            setPendingSaveData(null);
            setIsSaving(false);
            return;
          }
        }
      } catch {
        // il check è solo informativo: se fallisce, il salvataggio prosegue
      }
      setPendingSaveData(null);
      setIsSaving(false);
    }

    await performSave(data);
  }

  async function performSave(data: FormData) {
    if (!editing) return;
    setFormErrors({});
    setIsSaving(true);
    setError("");
    try {
      await request(`/api/admin/tickets/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          priority: data.get("priority"),
          status: data.get("status"),
          oreStimate: data.get("oreStimate") ? Number(data.get("oreStimate")) : null,
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
    } finally {
      setIsSaving(false);
    }

  }

  async function deleteTicket() {
    if (!deleting) return;
    if (isDeleting) return;
    setIsDeleting(true);
    setError("");
    try {
      await request(`/api/admin/tickets/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      await loadTickets();
      setMessage("Ticket eliminato.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Eliminazione non riuscita.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function togglePause() {
    if (!editing) return;
    if (isTogglingPause) return;
    setIsTogglingPause(true);
    setError("");
    const wasPaused = editing.paused;
    try {
      const action = wasPaused ? "resume" : "pause";
      const updated = await request(`/api/admin/tickets/${editing.id}/${action}`, { method: "POST" });
      setEditing((current) => (current ? { ...current, paused: updated.paused, pausedAt: updated.pausedAt } : current));
      await loadTickets();
      setMessage(wasPaused ? "Ticket ripreso." : "Ticket messo in pausa.");
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Operazione non riuscita.");
    } finally {
      setIsTogglingPause(false);
    }
  }

  const sidebarItemClass = (isActive: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-semibold transition-colors ${
      isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;

  return (
    <div className="flex min-h-screen flex-col text-slate-900 md:flex-row">
      <header className="grid grid-cols-3 items-center border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <button
          aria-label="Apri menu"
          className="justify-self-start rounded-lg p-2 text-xl"
          onClick={() => setIsSidebarOpen(true)}
          type="button"
        >
          ☰
        </button>
        <h1 className="text-center font-bold">Dashboard ticket</h1>
      </header>
      {isSidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      } md:sticky md:top-0 md:flex md:translate-x-0`}>
        <div className="flex items-start justify-between border-b border-slate-200 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Amministrazione</p>
            <h1 className="mt-1 text-xl font-bold">Dashboard ticket</h1>
          </div>
          <button
            aria-label="Chiudi menu"
            className="rounded-lg p-2 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-4" aria-label="Sezioni dashboard">
          <button aria-pressed={activeTab === "oggi"} className={sidebarItemClass(activeTab === "oggi")} onClick={() => { setActiveTab("oggi"); setIsSidebarOpen(false); }} type="button">📅 Oggi</button>
          <button aria-pressed={activeTab === "tickets"} className={sidebarItemClass(activeTab === "tickets")} onClick={() => { setActiveTab("tickets"); setIsSidebarOpen(false); }} type="button">🎫 Ticket</button>
          <button aria-pressed={activeTab === "diary"} className={sidebarItemClass(activeTab === "diary")} onClick={() => { setActiveTab("diary"); setIsSidebarOpen(false); }} type="button">📖 Diario</button>
          <button aria-pressed={activeTab === "contracts"} className={sidebarItemClass(activeTab === "contracts")} onClick={() => { setActiveTab("contracts"); setIsSidebarOpen(false); }} type="button">📝 Contratti</button>
          <Link className={sidebarItemClass(false)} href="/admin/time-entries" onClick={() => setIsSidebarOpen(false)}>⏱ Registro attività</Link>
          <Link className={sidebarItemClass(false)} href="/admin/reports" onClick={() => setIsSidebarOpen(false)}>📊 Report</Link>
        </nav>
        <div className="mt-auto border-t border-slate-200 p-4">
          <button className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-left font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isRunning} onClick={() => void runSchedule()} type="button">
            {isRunning ? "Pianificazione..." : "Ricalcola schedule"}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
        {message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}

        {activeTab === "tickets" && <section className="flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <select className="rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => {           const value = event.target.value; setStatusFilter(value); setPage(1); void loadTickets(value, priorityFilter, 1, showPaused); }} value={statusFilter}>
            <option value="">Tutti gli stati</option>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
          <select className="rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => {           const value = event.target.value; setPriorityFilter(value); setPage(1); void loadTickets(statusFilter, value, 1, showPaused); }} value={priorityFilter}>
            <option value="">Tutte le priorità</option>{priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">
            <input
              checked={showPaused}
              onChange={(event) => { const value = event.target.checked; setShowPaused(value); setPage(1); void loadTickets(statusFilter, priorityFilter, 1, value); }}
              type="checkbox"
            />
            Mostra anche in pausa
          </label>
        </section>}

        {activeTab === "oggi" && <section className="rounded-2xl bg-white p-6 shadow-sm">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">La tua giornata</h2>
              <p className="mt-1 capitalize text-slate-500">
                {todayData
                  ? new Intl.DateTimeFormat("it-IT", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(`${todayData.data}T12:00:00`))
                  : "Caricamento..."}
              </p>
            </div>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoadingToday}
              onClick={() => void loadTodayData()}
              type="button"
            >
              {isLoadingToday ? "Aggiornamento..." : "Aggiorna"}
            </button>
          </header>

          {todayData ? <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Ore pianificate oggi", formatDuration(todayData.orePianificateOggi)],
                ["Ore libere", formatDuration(todayData.oreLibere)],
                ["Ticket in ritardo", String(todayData.totaleInRitardo)],
                ["Ticket in pausa", String(todayData.ticketsInPausa.length)],
              ].map(([label, value]) => (
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={label}>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-bold">{value}</p>
                </article>
              ))}
            </div>

            <h3 className="mt-8 text-xl font-semibold">Cosa fare oggi</h3>
            {todayData.ticketsOggi.length === 0
              ? <p className="mt-4 rounded-xl bg-slate-50 p-5 text-slate-600">Nessun ticket pianificato per oggi. Goditi la giornata!</p>
              : <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {todayData.ticketsOggi.map((ticket) => (
                    <article
                      className={`rounded-xl border border-l-4 border-slate-200 p-4 ${todayPriorityBorders[ticket.priority] ?? "border-l-slate-400"} cursor-pointer hover:border-slate-300 hover:shadow-md transition-all`}
                      key={ticket.id}
                      onClick={() => void openTicketFromToday(ticket.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void openTicketFromToday(ticket.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h4 className="font-semibold">{ticket.title}</h4>
                        {ticket.inRitardo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">IN RITARDO</span>}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{ticket.clientName}</p>
                      <p className="mt-3 text-sm font-medium">{formatDuration(ticket.orePianificateOggi)} pianificate oggi</p>
                      {ticket.dueDate && <p className="mt-1 text-sm text-slate-500">Scadenza: {formatDate(ticket.dueDate)}</p>}
                    </article>
                  ))}
                </div>}

            {todayData.ticketsInPausa.length > 0 && (
              <details className="mt-6 rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer font-semibold">In pausa ({todayData.ticketsInPausa.length})</summary>
                <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
                  {todayData.ticketsInPausa.map((ticket) => <li key={ticket.id}>{ticket.title}</li>)}
                </ul>
              </details>
            )}
          </> : <p className="mt-6 text-slate-500">Caricamento dei dati di oggi...</p>}
        </section>}

        {activeTab === "tickets" && <><section className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          {loading ? <p className="p-6 text-slate-500">Caricamento...</p> : (
            <table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr>{["Titolo", "Cliente", "Tipo", "Priorità", "Stato", "Tracking", "Data stimata", "Azioni"].map((heading) => <th className="px-4 py-3 font-semibold" key={heading}>{heading}</th>)}</tr></thead>
              <tbody>{tickets.map((ticket) => { const styles = getPriorityStyles(ticket.priority); return <tr className={`border-b border-l-4 border-slate-100 last:border-0 ${styles.border} ${styles.background}`} key={ticket.id}><td className="px-4 py-4 font-medium"><span className="flex items-center gap-2">{ticket.title}{(!ticket.contract || ticket.contract.type !== "RETAINER") && (ticket.oreStimate ?? 0) <= 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">DA STIMARE</span>}{ticket.paused && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">IN PAUSA</span>}</span></td><td className="px-4 py-4">{ticket.client.name}<br /><span className="text-xs text-slate-600">{ticket.client.email}</span></td><td className="px-4 py-4">{ticket.type}</td><td className="px-4 py-4"><PriorityBadge priority={ticket.priority} /></td><td className="px-4 py-4">{statusLabels[ticket.status] || ticket.status}</td><td className="px-4 py-4"><code className="select-all rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{ticket.token}</code><br /><a className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline" href={`/t/${encodeURIComponent(ticket.token)}`} target="_blank" rel="noreferrer">Apri tracking</a></td><td className="px-4 py-4">{formatDate(ticket.dueDate)}</td><td className="flex gap-3 px-4 py-4"><button className="font-medium text-blue-700 hover:underline" onClick={() => { setFormErrors({}); setEditing(ticket); }}>Modifica</button><button aria-label={`Elimina ${ticket.title}`} className="text-red-700 hover:text-red-900" onClick={() => setDeleting(ticket)} title="Elimina" type="button">🗑</button></td></tr>; })}</tbody>
            </table>
          )}
        </section>
        {totalPages > 1 && (
          <nav className="flex items-center justify-between rounded-2xl bg-white p-4 text-sm shadow-sm" aria-label="Paginazione ticket">
            <button className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40" disabled={page === 1} onClick={() => void loadTickets(statusFilter, priorityFilter, page - 1, showPaused)} type="button">Precedente</button>
            <span>Pagina {page} di {totalPages}</span>
            <button className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40" disabled={page === totalPages} onClick={() => void loadTickets(statusFilter, priorityFilter, page + 1, showPaused)} type="button">Successiva</button>
          </nav>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Prossimi 30 giorni</h2>
          {heatmapData === null ? (
            <p className="mt-4 text-slate-500">{isLoadingHeatmap ? "Caricamento..." : "Dati heatmap non disponibili."}</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
                {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((weekday) => <span key={weekday}>{weekday}</span>)}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {Array.from({ length: (new Date(`${heatmapData[0].date}T12:00:00`).getDay() + 6) % 7 }, (_, index) => (
                  <span aria-hidden="true" key={`spacer-${index}`} />
                ))}
                {heatmapData.map((day) => {
                  const date = new Date(`${day.date}T12:00:00`);
                  const dateLabel = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(date);
                  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date);
                  const isToday = day.date === dateKey(new Date());
                  const colorClass = day.plannedHours === 0
                    ? "bg-slate-50 text-slate-400"
                    : day.plannedHours <= 4
                      ? "bg-emerald-100 text-emerald-800"
                      : day.plannedHours <= 6
                        ? "bg-yellow-100 text-yellow-800"
                        : day.plannedHours <= 8
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800";
                  const plannedHoursLabel = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(day.plannedHours);

                  return (
                    <div
                      className={`flex min-h-16 flex-col items-center justify-center rounded-lg p-2 text-sm ${colorClass} ${isToday ? "border-2 border-blue-500 font-bold" : "border border-transparent"}`}
                      key={day.date}
                      title={`${dateLabel}: ${plannedHoursLabel}h pianificate (${day.ticketCount} ticket)`}
                    >
                      <span>{date.getDate()}</span>
                      <span className="text-xs">{monthLabel}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
                {[
                  ["bg-slate-50", "0h"],
                  ["bg-emerald-100", ">0–4h"],
                  ["bg-yellow-100", ">4–6h"],
                  ["bg-orange-100", ">6–8h"],
                  ["bg-red-100", ">8h"],
                ].map(([color, label]) => (
                  <span className="flex items-center gap-1.5" key={label}>
                    <span className={`h-3 w-3 rounded-sm ${color}`} />{label}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
        {pausedTickets.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">In pausa ({pausedTickets.length})</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {pausedTickets.map((ticket) => (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3" key={ticket.id}>
                  <p className="font-semibold">{ticket.title}</p>
                  <p className="text-xs text-slate-600">{ticket.client.name}</p>
                  <p className="mt-2 text-xs text-slate-600">In pausa dal {formatDate(ticket.pausedAt)}</p>
                  <button
                    className="mt-3 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={resumingId === ticket.id}
                    onClick={() => void resumeTicket(ticket.id)}
                    type="button"
                  >
                    {resumingId === ticket.id ? "Ripresa..." : "Riprendi"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        </>}

        {activeTab === "diary" && <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Diario di lavoro</h2>
              <p className="mt-1 text-sm text-slate-500">Pianificazione dal {formatDate(dateKey(diaryStart))} al {formatDate(dateKey(diaryDates(diaryStart)[diaryDaysToShow - 1]))}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1" aria-label="Giorni da mostrare">
                {[3, 7, 14].map((days) => (
                  <button
                    aria-pressed={diaryDaysToShow === days}
                    className={`rounded-lg px-3 py-2 text-sm ${diaryDaysToShow === days ? "bg-blue-100 font-semibold text-blue-800" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                    key={days}
                    onClick={() => setDiaryDaysToShow(days)}
                    type="button"
                  >
                    {days} giorni
                  </button>
                ))}
              </div>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => void moveDiaryWeek(-1)} type="button">← Settimana precedente</button>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => void moveDiaryWeek(1)} type="button">Settimana successiva →</button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {diaryDates(diaryStart).slice(0, diaryDaysToShow).map((date) => {
              const isToday = dateKey(date) === dateKey(new Date());
              const entries = diary.filter((entry) => dateKey(new Date(entry.date)) === dateKey(date));
              const totalHours = entries.reduce((total, entry) => total + entry.plannedHours, 0);
              const overloaded = entries.some((entry) => entry.overflow) || totalHours > 8;
              return <div className={`min-h-40 rounded-xl p-3 ${isToday ? `border-2 border-blue-500 ${overloaded ? "bg-red-50" : "bg-blue-50"}` : overloaded ? "border border-red-400 bg-red-50" : "border border-slate-200 bg-slate-50"}`} key={dateKey(date)}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(date)}</h3>
                  <span className={`text-xs font-semibold ${overloaded ? "text-red-700" : "text-slate-600"}`}>{formatHours(totalHours)}h / 8h</span>
                </div>
                {overloaded && <p className="mt-2 text-xs font-semibold text-red-700">⚠ Capacità giornaliera superata</p>}
                {entries.length === 0 ? <p className="mt-4 text-xs text-slate-500">Nessun ticket pianificato</p> : entries.map((entry) => {
                  const styles = getPriorityStyles(entry.ticket.priority);
                  return <button className={`mt-2 block w-full rounded border-l-4 p-2 text-left text-xs transition hover:ring-2 hover:ring-blue-300 ${styles.border} ${styles.background}`} key={`${dateKey(date)}-${entry.ticket.id}`} onClick={() => void openDiaryTicket(entry.ticket.id)} type="button">
                    <span className="flex items-center justify-between gap-2"><span className="font-semibold">{entry.ticket.title}</span><PriorityBadge priority={entry.ticket.priority} /></span>
                    <span className="mt-1 block">{formatHours(entry.plannedHours)}h pianificate{entry.ticket.oreStimate == null ? " / quota retainer" : ` / ${formatHours(entry.ticket.oreStimate)}h totali`}</span>
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
        {editing && <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 px-4"><form className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl" onSubmit={saveTicket}><div className="flex justify-between"><h2 className="text-xl font-semibold">Modifica ticket</h2><button onClick={() => setEditing(null)} type="button">✕</button></div><div className="flex items-center gap-2"><p className="font-medium">{editing.title}</p>{editing.paused && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">IN PAUSA</span>}</div><label className="block text-sm font-medium">Priorità<select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.priority} name="priority">{priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label><label className="block text-sm font-medium">Stato<select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.status} name="status">{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label><label className="block text-sm font-medium">Ore previste<input className={`mt-2 w-full rounded-lg border px-3 py-2 ${formErrors.oreStimate ? "border-red-500 focus:ring-red-500" : "border-slate-300"}`} defaultValue={editing.oreStimate ?? ""} min="0" name="oreStimate" step="0.5" type="number" />{formErrors.oreStimate && <p className="mt-1 text-sm text-red-600">{formErrors.oreStimate}</p>}</label><label className="block text-sm font-medium">Tariffa oraria (€)<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.hourlyRate ?? ""} min="0" name="hourlyRate" step="1" type="number" /></label><label className="block text-sm font-medium">Prezzo preventivo fisso (€)<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.fixedPrice ?? ""} min="0" name="fixedPrice" step="0.01" type="number" /></label><label className="flex items-center gap-2 text-sm font-medium"><input defaultChecked={editing.showPrice} name="showPrice" type="checkbox" />Mostra prezzo nel tracking</label><label className="block text-sm font-medium">Contratto<select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.contractId ?? (contracts.filter((contract) => contract.client.id === editing.client.id).length === 1 ? contracts.find((contract) => contract.client.id === editing.client.id)?.id : "")} name="contractId"><option value="">Nessun contratto</option>{contracts.filter((contract) => contract.client.id === editing.client.id).map((contract) => <option key={contract.id} value={contract.id}>{contract.name} ({contract.type})</option>)}</select></label><label className="block text-sm font-medium">Data di scadenza<input className={`mt-2 w-full rounded-lg border px-3 py-2 ${formErrors.dueDate ? "border-red-500 focus:ring-red-500" : "border-slate-300"}`} defaultValue={editing.dueDate ? editing.dueDate.slice(0, 10) : ""} name="dueDate" type="date" />{formErrors.dueDate && <p className="mt-1 text-sm text-red-600">{formErrors.dueDate}</p>}</label><div className="flex items-center justify-between gap-3"><button className={`rounded-lg px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${editing.paused ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}`} disabled={isTogglingPause} onClick={() => void togglePause()} type="button">{isTogglingPause ? "Attendere..." : editing.paused ? "Riprendi" : "Metti in pausa"}</button><div className="flex gap-3"><button className="rounded-lg border border-slate-300 px-4 py-2" disabled={isSaving} onClick={() => setEditing(null)} type="button">Annulla</button><button className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Salvataggio..." : "Salva"}</button></div></div></form></div>}
        {deleting && <div aria-labelledby="delete-title" aria-modal="true" className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4" role="dialog"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-semibold" id="delete-title">Eliminare il ticket?</h2><p className="mt-3 text-slate-600">Stai per eliminare definitivamente <strong>{deleting.title}</strong> e i dati associati.</p><div className="mt-6 flex justify-end gap-3"><button className="rounded-lg border border-slate-300 px-4 py-2" disabled={isDeleting} onClick={() => setDeleting(null)} type="button">Annulla</button><button className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isDeleting} onClick={() => void deleteTicket()} type="button">{isDeleting ? "Eliminazione..." : "Elimina"}</button></div></div></div>}
        </div>
      </main>
    </div>
  );
}
