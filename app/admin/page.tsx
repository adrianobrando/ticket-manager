"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  HelpCircle,
  List,
  ListTodo,
  Menu,
  PauseCircle,
  Pencil,
  Ticket as TicketIcon,
  Trash2,
  X,
} from "lucide-react";
import { getPriorityStyles, PriorityBadge } from "@/app/components/ui";

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center text-slate-400 hover:text-slate-700 cursor-help ml-1" title={text}>
      <HelpCircle aria-label={text} size={14} />
    </span>
  );
}

type AppNotification = { id: string; text: string; icon: "alert" | "clock" | "flame"; onClick?: () => void };

function NotificationBell({ notifications }: { notifications: AppNotification[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const icons = {
    alert: <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-red-600" size={16} />,
    clock: <Clock3 aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" size={16} />,
    flame: <Flame aria-hidden="true" className="mt-0.5 shrink-0 text-orange-600" size={16} />,
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-label="Notifiche"
        className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <Bell aria-hidden="true" size={20} />
        {notifications.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-80 w-72 overflow-y-auto rounded-xl bg-white p-2 text-slate-900 shadow-lg ring-1 ring-slate-200">
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-600">Tutto tranquillo, nessuna notifica</p>
          ) : (
            <ul className="space-y-1">
              {notifications.map((n) => (
                <li
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50${n.onClick ? " cursor-pointer" : ""}`}
                  key={n.id}
                  onClick={n.onClick ? () => { n.onClick?.(); setIsOpen(false); } : undefined}
                >
                  {icons[n.icon]}
                  <span>{n.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type DeadlineType = "HARD" | "SOFT" | "NONE";
type HeatmapBucket = { hours: number; ticketIds: string[] };
type HeatmapDay = { date: string; byType: Record<DeadlineType, HeatmapBucket> };

type Ticket = {
  id: string;
  title: string;
  token: string;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
  dueDate: string | null;
  deadlineType: DeadlineType;
  oreStimate: number | null;
  oreConsuntivate: number;
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
  lateVsTarget: boolean;
  ticket: { id: string; title: string; priority: string; oreStimate: number | null; dueDate: string | null; deadlineType: DeadlineType };
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
    deadlineType: DeadlineType;
    delayed: boolean;
    lateVsTarget: boolean;
    orePianificateOggi: number;
    dueDate: string | null;
    inRitardo: boolean;
  }[];
  ticketsInPausa: {
    id: string;
    title: string;
    clientName: string;
    deadlineType: DeadlineType;
    lateVsTarget: boolean;
    pausedAt: string | null;
  }[];
  ticketsSoftOltreTarget: {
    id: string;
    title: string;
    clientName: string;
    deadlineType: DeadlineType;
    lateVsTarget: boolean;
    dueDate: string;
    scheduledTaskEndDate: string;
  }[];
  ticketsHardInRitardo: {
    id: string;
    title: string;
    clientName: string;
    dueDate: string;
    scheduledTaskEndDate: string;
  }[];
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

const TICKETS_PER_PAGE = 20;

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

function daysBetweenDates(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const fromDay = Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate());
  const toDay = Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate());
  return Math.round((toDay - fromDay) / 86400000);
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
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);
  const [copyErrorTicketId, setCopyErrorTicketId] = useState<string | null>(null);
  const [ticketFilter, setTicketFilter] = useState<"todo" | "paused" | "completed" | "all" | "archived">("todo");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [deadlineType, setDeadlineType] = useState<DeadlineType>("HARD");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync local form state when the edited ticket changes
    setDeadlineType(editing?.deadlineType ?? "HARD");
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ ticketId: string; oldDate: string; newDate: string; plannedHours: number; wasPinned: boolean } | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [activeTab, setActiveTab] = useState<"oggi" | "tickets" | "diary" | "contracts">("oggi");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [isLoadingToday, setIsLoadingToday] = useState(false);
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);

  const filteredTickets = tickets.filter((ticket) => {
    if (priorityFilter && ticket.priority !== priorityFilter) return false;
    if (ticketFilter === "todo") {
      return ticket.status !== "completed" && ticket.status !== "cancelled" && !ticket.paused;
    }
    if (ticketFilter === "paused") {
      return ticket.paused && ticket.status !== "completed" && ticket.status !== "cancelled";
    }
    if (ticketFilter === "completed") return ticket.status === "completed";
    if (ticketFilter === "all") return ticket.status !== "cancelled";
    return ticket.status === "cancelled";
  });
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / TICKETS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visibleTickets = filteredTickets.slice((currentPage - 1) * TICKETS_PER_PAGE, currentPage * TICKETS_PER_PAGE);

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

  async function loadTickets() {
    setLoading(true);
    setError("");
    try {
      // L'API limita pageSize a 100: scarico tutte le pagine, filtro e impagino in locale.
      const all: Ticket[] = [];
      let nextPage = 1;
      let pages = 1;
      do {
        const result = await request(`/api/admin/tickets?includePaused=true&pageSize=100&page=${nextPage}`);
        all.push(...result.tickets);
        pages = result.totalPages;
        nextPage += 1;
      } while (nextPage <= pages);
      setTickets(all);
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

  async function copyTrackingToken(ticket: Ticket) {
    setCopiedTicketId(null);
    setCopyErrorTicketId(null);
    try {
      const trackingUrl = new URL(
        `/t/${encodeURIComponent(ticket.token)}`,
        window.location.origin,
      ).toString();
      await navigator.clipboard.writeText(trackingUrl);
      setCopiedTicketId(ticket.id);
    } catch {
      setCopyErrorTicketId(ticket.id);
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

  async function undoLastMove() {
    if (!lastMove || isUndoing) return;
    const move = lastMove;
    setIsUndoing(true);
    try {
      await request("/api/admin/workdays/move", { method: "POST", body: JSON.stringify({ ticketId: move.ticketId, oldDate: move.newDate, newDate: move.oldDate, plannedHours: move.plannedHours, pin: move.wasPinned }) });
      setLastMove(null);
      await loadDiary(diaryStart);
    } catch (undoError) {
      if (undoError instanceof Error && undoError.message === "AUTH_REQUIRED") {
        router.replace("/admin/login");
        return;
      }
      setError(undoError instanceof Error ? undoError.message : "Impossibile annullare lo spostamento.");
    } finally {
      setIsUndoing(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "diary" || !lastMove) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void undoLastMove();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function handleDragStart(event: React.DragEvent, entry: DiaryEntry, date: Date) {
    event.dataTransfer.setData("application/json", JSON.stringify({ ticketId: entry.ticket.id, oldDate: dateKey(date), plannedHours: entry.plannedHours }));
    event.dataTransfer.effectAllowed = "move";
  }

  async function handleDrop(event: React.DragEvent, targetDate: Date) {
    event.preventDefault();
    setDragOverDate(null);
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      const { ticketId, oldDate, plannedHours } = JSON.parse(raw);
      const newDate = dateKey(targetDate);
      if (!ticketId || oldDate === newDate) return;
      const result = await request("/api/admin/workdays/move", { method: "POST", body: JSON.stringify({ ticketId, oldDate, newDate, plannedHours }) });
      setLastMove({ ticketId, oldDate, newDate, plannedHours: result.plannedHours ?? plannedHours, wasPinned: Boolean(result.wasPinned) });
      await loadDiary(diaryStart);
    } catch (dropError) {
      if (dropError instanceof Error && dropError.message === "AUTH_REQUIRED") {
        router.replace("/admin/login");
        return;
      }
      setError(dropError instanceof Error ? dropError.message : "Impossibile spostare il ticket.");
    }
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
      if (deadlineType === "HARD" && !data.get("dueDate")) {
        setFormErrors({ dueDate: "Inserisci la data di consegna" });
        return;
      }

      setIsSaving(true);
      if (deadlineType === "HARD" && data.get("dueDate")) {
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
          deadlineType,
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
  const ticketsHardOggi = todayData?.ticketsOggi.filter(
    (ticket) => ticket.deadlineType === "HARD",
  ) ?? [];
  const oreHardPianificateOggi = ticketsHardOggi.reduce(
    (total, ticket) => total + ticket.orePianificateOggi,
    0,
  );
  const oreLibereOggi = Math.max(0, 8 - oreHardPianificateOggi);
  const goToAccordion = (accordionId: string) => {
    setActiveTab("oggi");
    setTimeout(() => {
      const el = document.getElementById(accordionId) as HTMLDetailsElement | null;
      if (el) {
        el.open = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };
  const notifications: AppNotification[] = [];
  if (todayData && todayData.totaleInRitardo > 0) {
    notifications.push({
      id: "late",
      icon: "alert",
      text: `⚠️ Hai ${todayData.totaleInRitardo} ticket HARD in ritardo.`,
      onClick: () => goToAccordion("hard-late-accordion"),
    });
  }
  if (todayData && todayData.ticketsSoftOltreTarget.length > 0) {
    notifications.push({
      id: "soft",
      icon: "clock",
      text: `⏳ ${todayData.ticketsSoftOltreTarget.length} ticket Soft sono oltre target.`,
      onClick: () => goToAccordion("soft-late-accordion"),
    });
  }
  if (oreHardPianificateOggi > 8) {
    notifications.push({
      id: "overload",
      icon: "flame",
      text: `🔥 Oggi sei in sovraccarico (${formatDuration(oreHardPianificateOggi)} HARD pianificate).`,
      onClick: () => setActiveTab("diary"),
    });
  }

  return (
    <div className="flex min-h-screen flex-col text-slate-900 md:flex-row">
      <header className="grid grid-cols-3 items-center border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <button
          aria-label="Apri menu"
          className="justify-self-start rounded-lg p-2 text-xl"
          onClick={() => setIsSidebarOpen(true)}
          type="button"
        >
          <Menu aria-hidden="true" size={20} />
        </button>
        <h1 className="text-center font-bold">Dashboard ticket</h1>
        <div className="justify-self-end">
          <NotificationBell notifications={notifications} />
        </div>
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
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-4" aria-label="Sezioni dashboard">
          <button aria-pressed={activeTab === "oggi"} className={sidebarItemClass(activeTab === "oggi")} onClick={() => { setActiveTab("oggi"); setIsSidebarOpen(false); }} type="button"><CalendarDays aria-hidden="true" size={18} /><span>Oggi</span></button>
          <button aria-pressed={activeTab === "tickets"} className={sidebarItemClass(activeTab === "tickets")} onClick={() => { setActiveTab("tickets"); setIsSidebarOpen(false); }} type="button"><TicketIcon aria-hidden="true" size={18} /><span>Ticket</span></button>
          <button aria-pressed={activeTab === "diary"} className={sidebarItemClass(activeTab === "diary")} onClick={() => { setActiveTab("diary"); setIsSidebarOpen(false); }} type="button"><BookOpen aria-hidden="true" size={18} /><span>Diario</span></button>
          <button aria-pressed={activeTab === "contracts"} className={sidebarItemClass(activeTab === "contracts")} onClick={() => { setActiveTab("contracts"); setIsSidebarOpen(false); }} type="button"><FileText aria-hidden="true" size={18} /><span>Contratti</span></button>
          <Link className={sidebarItemClass(false)} href="/admin/time-entries" onClick={() => setIsSidebarOpen(false)}><Clock3 aria-hidden="true" size={18} /><span>Registro attività</span></Link>
          <Link className={sidebarItemClass(false)} href="/admin/reports" onClick={() => setIsSidebarOpen(false)}><BarChart3 aria-hidden="true" size={18} /><span>Report</span></Link>
        </nav>
        <div className="mt-auto border-t border-slate-200 p-4">
          <button className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-left font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isRunning} onClick={() => void runSchedule()} type="button">
            {isRunning ? "Pianificazione..." : "Ricalcola schedule"}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
        <div className="hidden items-center justify-end md:flex">
          <NotificationBell notifications={notifications} />
        </div>
        {message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}

        {activeTab === "tickets" && <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <nav aria-label="Filtra ticket" className="flex flex-wrap items-center gap-2">
            {([
              ["todo", "Da Fare", ListTodo],
              ["paused", "In Pausa", PauseCircle],
              ["completed", "Completati", CheckCircle2],
              ["all", "Tutti", List],
            ] as const).map(([filter, label, Icon]) => (
              <button
                aria-pressed={ticketFilter === filter}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${ticketFilter === filter ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
                key={filter}
                onClick={() => { setTicketFilter(filter); setPage(1); }}
                type="button"
              >
                <Icon aria-hidden="true" size={16} />
                {label}
              </button>
            ))}
            <button
              aria-pressed={ticketFilter === "archived"}
              className={`ml-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${ticketFilter === "archived" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
              onClick={() => { setTicketFilter("archived"); setPage(1); }}
              type="button"
            >
              <Archive aria-hidden="true" size={14} />
              Archivio
            </button>
          </nav>
          <select className="rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => { setPriorityFilter(event.target.value); setPage(1); }} value={priorityFilter}>
            <option value="">Tutte le priorità</option>{priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
          </select>
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
              {([
                ["Ore pianificate oggi", formatDuration(oreHardPianificateOggi), null],
                ["Ore libere", formatDuration(oreLibereOggi), "Calcolate solo sulle ore HARD (impegni rigidi). I ticket flessibili non intaccano questo numero."],
                ["Ticket in ritardo", String(todayData.totaleInRitardo), null],
                ["Ticket in pausa", String(todayData.ticketsInPausa.length), null],
              ] as const).map(([label, value, hint]) => (
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={label}>
                  <p className="text-sm text-slate-500">{label}{hint && <InfoTooltip text={hint} />}</p>
                  <p className="mt-1 text-2xl font-bold">{value}</p>
                </article>
              ))}
            </div>

            {todayData.ticketsHardInRitardo.length > 0 && (
              <details className="mt-4 rounded-xl border border-red-200 p-4" id="hard-late-accordion">
                <summary className="cursor-pointer font-semibold">
                  Ticket HARD in ritardo ({todayData.ticketsHardInRitardo.length})
                </summary>
                <ul className="mt-3 space-y-3 text-sm">
                  {todayData.ticketsHardInRitardo.map((ticket) => {
                    const daysLate = daysBetweenDates(ticket.dueDate, ticket.scheduledTaskEndDate);
                    return (
                      <li className="rounded-lg bg-red-50 p-3" key={ticket.id}>
                        <p className="font-semibold">{ticket.title}</p>
                        <p className="text-slate-600">{ticket.clientName}</p>
                        <p className="mt-1 text-slate-600">
                          Scadenza: {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(ticket.dueDate))}
                        </p>
                        <p className="font-medium text-red-600">
                          {daysLate} {daysLate === 1 ? "giorno" : "giorni"} di ritardo
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}

            {todayData.ticketsSoftOltreTarget.length > 0 && (
              <details className="mt-4 rounded-xl border border-amber-200 p-4" id="soft-late-accordion">
                <summary className="cursor-pointer font-semibold">
                  Soft oltre target ({todayData.ticketsSoftOltreTarget.length})
                </summary>
                <ul className="mt-3 space-y-3 text-sm">
                  {todayData.ticketsSoftOltreTarget.map((ticket) => {
                    const daysBeyond = daysBetweenDates(ticket.dueDate, ticket.scheduledTaskEndDate);
                    return (
                      <li className="rounded-lg bg-amber-50 p-3" key={ticket.id}>
                        <p className="font-semibold">{ticket.title}</p>
                        <p className="text-slate-600">{ticket.clientName}</p>
                        <p className="mt-1 text-slate-600">Target: {formatDate(ticket.dueDate)}</p>
                        <p className="font-medium text-amber-800">
                          {daysBeyond} {daysBeyond === 1 ? "giorno" : "giorni"} oltre
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}

            <h3 className="mt-8 text-xl font-semibold">Cosa fare oggi</h3>
            {ticketsHardOggi.length === 0
              ? <p className="mt-4 rounded-xl bg-slate-50 p-5 text-slate-600">Nessun ticket pianificato per oggi. Goditi la giornata!</p>
              : <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {ticketsHardOggi.map((ticket) => (
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
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-white">
                <tr>
                  {["Titolo", "Cliente", "Tipo", "Priorità", "Stato", "Tracking", "Data stimata", "Azioni"].map((heading) => (
                    <th className="px-4 py-3 font-semibold text-slate-800" key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleTickets.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={8}>Nessun ticket per questo filtro.</td></tr>
                ) : visibleTickets.map((ticket) => {
                  const styles = getPriorityStyles(ticket.priority);
                  return (
                    <tr className={`border-b border-l-4 border-slate-100 last:border-0 ${styles.border} ${styles.background}`} key={ticket.id}>
                      <td className="px-4 py-4 font-medium">
                        <span className="flex items-center gap-2">
                          {ticket.title}
                          {(!ticket.contract || ticket.contract.type !== "RETAINER") && (ticket.oreStimate ?? 0) <= 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">DA STIMARE</span>
                          )}
                          {ticket.paused && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">IN PAUSA</span>}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {ticket.client.name}
                        <br />
                        <span className="text-xs text-slate-600">{ticket.client.email}</span>
                      </td>
                      <td className="px-4 py-4">{ticket.type}</td>
                      <td className="px-4 py-4"><PriorityBadge priority={ticket.priority} /></td>
                      <td className="px-4 py-4">{statusLabels[ticket.status] || ticket.status}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-start gap-2">
                          <a
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                            href={`/t/${encodeURIComponent(ticket.token)}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <ExternalLink aria-hidden="true" size={14} />
                            Apri tracking
                          </a>
                          <button
                            aria-label={copiedTicketId === ticket.id ? "Link di tracking copiato" : `Copia link di tracking per ${ticket.title}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            onClick={() => void copyTrackingToken(ticket)}
                            type="button"
                          >
                            {copiedTicketId === ticket.id
                              ? <Check aria-hidden="true" size={14} />
                              : <Copy aria-hidden="true" size={14} />}
                            {copiedTicketId === ticket.id ? "Link copiato" : "Copia link"}
                          </button>
                          {copyErrorTicketId === ticket.id && (
                            <span aria-live="polite" className="max-w-40 text-xs text-red-700">
                              Copia del link non riuscita. Verifica i permessi del browser.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">{formatDate(ticket.dueDate)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            aria-label={`Modifica ${ticket.title}`}
                            className="rounded-lg p-2 text-blue-700 transition hover:bg-blue-50"
                            onClick={() => { setFormErrors({}); setEditing(ticket); }}
                            title="Modifica"
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={16} />
                          </button>
                          <button
                            aria-label={`Elimina ${ticket.title}`}
                            className="rounded-lg p-2 text-red-700 transition hover:bg-red-50"
                            onClick={() => setDeleting(ticket)}
                            title="Elimina"
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        {totalPages > 1 && (
          <nav className="flex items-center justify-between rounded-2xl bg-white p-4 text-sm shadow-sm" aria-label="Paginazione ticket">
            <button className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button">Precedente</button>
            <span>Pagina {currentPage} di {totalPages}</span>
            <button className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} type="button">Successiva</button>
          </nav>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          {(() => {
            const dailyHours = (heatmapData ?? []).map((day) =>
              day.byType.HARD.hours + (showAll ? day.byType.SOFT.hours + day.byType.NONE.hours : 0));
            const avg = dailyHours.length ? dailyHours.reduce((a, b) => a + b, 0) / dailyHours.length : 0;
            const avgLabel = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(avg);
            return (
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-xl font-semibold">Prossimi 30 giorni<InfoTooltip text="La vista 'Davvero impegnato' mostra solo i ticket HARD. 'Tutto il lavoro' include anche i flessibili." /></h2>
                {heatmapData && (
                  <span className="text-sm text-slate-500">
                    {showAll ? "Tutto il lavoro" : "Davvero impegnato"}: {avgLabel}h medie/giorno
                  </span>
                )}
              </div>
            );
          })()}
          <div className="mt-3 flex gap-2" role="group" aria-label="Vista heatmap">
            {([[false, "Davvero impegnato"], [true, "Tutto il lavoro"]] as const).map(([value, label]) => (
              <button
                aria-pressed={showAll === value}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${showAll === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                key={label}
                onClick={() => setShowAll(value)}
                type="button"
              >{label}</button>
            ))}
          </div>
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
                  const plannedHours = day.byType.HARD.hours + (showAll ? day.byType.SOFT.hours + day.byType.NONE.hours : 0);
                  const ticketCount = new Set([
                    ...day.byType.HARD.ticketIds,
                    ...(showAll ? [...day.byType.SOFT.ticketIds, ...day.byType.NONE.ticketIds] : []),
                  ]).size;
                  const colorClass = plannedHours === 0
                    ? "bg-slate-50 text-slate-400"
                    : plannedHours <= 4
                      ? "bg-emerald-100 text-emerald-800"
                      : plannedHours <= 6
                        ? "bg-yellow-100 text-yellow-800"
                        : plannedHours <= 8
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800";
                  const plannedHoursLabel = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(plannedHours);

                  return (
                    <div
                      className={`flex min-h-16 flex-col items-center justify-center rounded-lg p-2 text-sm ${colorClass} ${isToday ? "border-2 border-blue-500 font-bold" : "border border-transparent"}`}
                      key={day.date}
                      title={`${dateLabel}: ${plannedHoursLabel}h pianificate (${ticketCount} ticket)`}
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
          {lastMove && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900" role="status">
            <span>Ticket spostato al {formatDate(lastMove.newDate)}.</span>
            <span className="flex gap-2">
              <button className="rounded-lg border border-blue-300 bg-white px-3 py-1 font-semibold hover:bg-blue-100 disabled:opacity-50" disabled={isUndoing} onClick={() => void undoLastMove()} type="button">{isUndoing ? "Annullo…" : "Annulla (⌘Z)"}</button>
              <button aria-label="Chiudi" className="px-2 text-blue-700 hover:text-blue-900" onClick={() => setLastMove(null)} type="button">×</button>
            </span>
          </div>}
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
              const hardEntries = entries.filter((entry) => entry.ticket.deadlineType === "HARD");
              const softEntries = entries.filter((entry) => entry.ticket.deadlineType !== "HARD");
              const hardHours = hardEntries.reduce((total, entry) => total + entry.plannedHours, 0);
              const softHours = softEntries.reduce((total, entry) => total + entry.plannedHours, 0);
              const overloaded = hardEntries.some((entry) => entry.overflow) || hardHours > 8;
              return <div className={`min-h-40 rounded-xl p-3 ${isToday ? `border-2 border-blue-500 ${overloaded ? "bg-red-50" : "bg-blue-50"}` : overloaded ? "border border-red-400 bg-red-50" : "border border-slate-200 bg-slate-50"} ${dragOverDate === dateKey(date) ? "ring-2 ring-blue-400 bg-blue-50/50" : ""}`} key={dateKey(date)} onDragOver={(e) => e.preventDefault()} onDragEnter={() => setDragOverDate(dateKey(date))} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOverDate(null); }} onDrop={(e) => void handleDrop(e, date)}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(date)}</h3>
                </div>
                {overloaded && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-700"><AlertTriangle aria-hidden="true" size={14} />Capacità giornaliera superata</p>}
                <section aria-label="Da fare" className="mt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900">DA FARE</h4>
                    <span className={`text-sm font-semibold ${overloaded ? "text-red-700" : "text-slate-700"}`}>{formatHours(hardHours)}h / 8h</span>
                  </div>
                  {hardEntries.length === 0
                    ? <p className="mt-2 text-xs text-slate-400">Nessun impegno rigido</p>
                    : hardEntries.map((entry, entryIndex) => {
                      const styles = getPriorityStyles(entry.ticket.priority);
                      return <button draggable="true" onDragStart={(e) => handleDragStart(e, entry, date)} className={`mt-2 block w-full rounded border-l-4 p-2 text-left text-xs transition hover:ring-2 hover:ring-blue-300 ${styles.border} ${styles.background}`} key={`${dateKey(date)}-${entry.ticket.id}-${entryIndex}`} onClick={() => void openDiaryTicket(entry.ticket.id)} type="button">
                        <span className="flex items-center justify-between gap-2"><span className="font-semibold">{entry.ticket.title}</span><PriorityBadge priority={entry.ticket.priority} /></span>
                        <span className="mt-1 block">{formatHours(entry.plannedHours)}h pianificate{entry.ticket.oreStimate == null ? " / quota retainer" : ` / ${formatHours(entry.ticket.oreStimate)}h totali`}</span>
                        {entry.ticket.dueDate && <span className="mt-1 block text-slate-600">Scadenza: {formatDate(entry.ticket.dueDate)}</span>}
                        {entry.delayed && <span className="mt-1 block font-semibold text-red-700">Ritardo previsto</span>}
                      </button>;
                    })}
                </section>
                {softEntries.length > 0 && <section aria-label="Non urgente" className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white/60 p-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-500">Non urgente</h4>
                    <span className="text-xs text-slate-400">({formatHours(softHours)}h)</span>
                  </div>
                  {softEntries.map((entry, entryIndex) => <button draggable="true" onDragStart={(e) => handleDragStart(e, entry, date)} className="mt-1 block w-full rounded border-l-2 border-slate-300 bg-slate-50 p-1.5 text-left text-[11px] text-slate-600 transition hover:ring-1 hover:ring-blue-300" key={`${dateKey(date)}-${entry.ticket.id}-${entryIndex}`} onClick={() => void openDiaryTicket(entry.ticket.id)} type="button">
                    <span className="flex items-center justify-between gap-2"><span className="font-medium">{entry.ticket.title}</span><span>{formatHours(entry.plannedHours)}h</span></span>
                    {entry.ticket.deadlineType === "SOFT" && entry.ticket.dueDate && <span className="block text-slate-400">target: {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(new Date(entry.ticket.dueDate))}</span>}
                    {entry.lateVsTarget && <span className="block font-semibold text-amber-600">Oltre target</span>}
                  </button>)}
                </section>}
              </div>;
            })}
          </div>
        </section>}
        {activeTab === "contracts" && <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Contratti</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">{contracts.map((contract) => { const included = contract.monthlyHoursIncluded ?? 0; const percentage = included ? Math.min(100, (contract.registeredHours / included) * 100) : 0; return <article className="rounded-xl border border-slate-200 p-4" key={contract.id}><div className="flex justify-between gap-3"><div><h3 className="font-semibold">{contract.client.name}</h3><p className="text-sm text-slate-500">{contract.name} · {contract.type === "RETAINER" ? "Retainer" : "Hourly"}</p></div><span className="text-sm font-semibold">{contract.hourlyRate.toFixed(2)} €/h</span></div>{contract.type === "RETAINER" ? <><div className="mt-4 flex justify-between text-sm"><span>{formatHours(included)}h incluse</span><span>{formatHours(contract.registeredHours)}h registrate</span><span>{formatHours(contract.remainingHours)}h rimanenti</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${contract.remainingHours < 0 ? "bg-red-500" : "bg-blue-600"}`} style={{ width: `${percentage}%` }} /></div></> : <p className="mt-4 text-sm">{formatHours(contract.registeredHours)}h registrate</p>}{contract.tickets.length > 0 && <p className="mt-3 text-xs text-slate-500">Ticket: {contract.tickets.slice(0, 3).map((ticket) => ticket.title).join(", ")}</p>}<Link className="mt-4 inline-block text-sm font-semibold text-blue-700" href={`/admin/reports?contractId=${contract.id}`}>Report</Link></article>; })}</div>
          {contracts.length === 0 && <p className="mt-4 text-sm text-slate-500">Nessun contratto attivo.</p>}
        </section>}
        {editing && (
          <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 px-4">
            <form className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl" onSubmit={saveTicket}>
              <div className="flex justify-between">
                <h2 className="text-xl font-semibold">Modifica ticket</h2>
                <button aria-label="Chiudi modifica" onClick={() => setEditing(null)} type="button">
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{editing.title}</p>
                {editing.paused && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">IN PAUSA</span>}
              </div>
              <label className="block text-sm font-medium">
                Priorità
                <select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.priority} name="priority">
                  {priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Stato
                <select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.status} name="status">
                  {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Ore previste
                <InfoTooltip text="Se le ore lavorate superano queste, apparirà un avviso di sforamento e il ticket rimarrà in calendario per essere chiuso." />
                <input className={`mt-2 w-full rounded-lg border px-3 py-2 ${formErrors.oreStimate ? "border-red-500 focus:ring-red-500" : "border-slate-300"}`} defaultValue={editing.oreStimate ?? ""} min="0" name="oreStimate" step="0.5" type="number" />
                {formErrors.oreStimate && <p className="mt-1 text-sm text-red-600">{formErrors.oreStimate}</p>}
                {(editing.oreStimate ?? 0) > 0 && editing.oreConsuntivate > (editing.oreStimate ?? 0) && (
                  <p className="mt-1 text-sm font-medium text-orange-600">
                    Sforamento: +{formatHours(editing.oreConsuntivate - (editing.oreStimate ?? 0))}h rispetto alle ore previste
                  </p>
                )}
              </label>
              <label className="block text-sm font-medium">
                Tariffa oraria (€)
                <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.hourlyRate ?? ""} min="0" name="hourlyRate" step="1" type="number" />
              </label>
              <label className="block text-sm font-medium">
                Prezzo preventivo fisso (€)
                <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.fixedPrice ?? ""} min="0" name="fixedPrice" step="0.01" type="number" />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input defaultChecked={editing.showPrice} name="showPrice" type="checkbox" />
                Mostra prezzo nel tracking
              </label>
              <label className="block text-sm font-medium">
                Contratto
                <select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue={editing.contractId ?? (contracts.filter((contract) => contract.client.id === editing.client.id).length === 1 ? contracts.find((contract) => contract.client.id === editing.client.id)?.id : "")} name="contractId">
                  <option value="">Nessun contratto</option>
                  {contracts.filter((contract) => contract.client.id === editing.client.id).map((contract) => <option key={contract.id} value={contract.id}>{contract.name} ({contract.type})</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Tipo scadenza
                <InfoTooltip text="Rigida: scadenza vera. Morbida: data indicativa, non blocca. Nessuna: backlog senza data, non conta come capacità." />
                <select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" name="deadlineType" onChange={(e) => setDeadlineType(e.target.value as DeadlineType)} value={deadlineType}>
                  <option value="HARD">Rigida</option>
                  <option value="SOFT">Morbida</option>
                  <option value="NONE">Nessuna</option>
                </select>
              </label>
              {deadlineType !== "NONE" && (
                <label className="block text-sm font-medium">
                  {deadlineType === "SOFT" ? "Data target (opzionale)" : "Scadenza"}
                  <input className={`mt-2 w-full rounded-lg border px-3 py-2 ${formErrors.dueDate ? "border-red-500 focus:ring-red-500" : "border-slate-300"}`} defaultValue={editing.dueDate ? editing.dueDate.slice(0, 10) : ""} name="dueDate" type="date" />
                  {formErrors.dueDate && <p className="mt-1 text-sm text-red-600">{formErrors.dueDate}</p>}
                </label>
              )}
              <div className="flex items-center justify-between gap-3">
                <button className={`rounded-lg px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${editing.paused ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}`} disabled={isTogglingPause} onClick={() => void togglePause()} type="button">
                  {isTogglingPause ? "Attendere..." : editing.paused ? "Riprendi" : "Metti in pausa"}
                </button>
                <div className="flex gap-3">
                  <button className="rounded-lg border border-slate-300 px-4 py-2" disabled={isSaving} onClick={() => setEditing(null)} type="button">Annulla</button>
                  <button className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">
                    {isSaving ? "Salvataggio..." : "Salva"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
        {deleting && <div aria-labelledby="delete-title" aria-modal="true" className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4" role="dialog"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-semibold" id="delete-title">Eliminare il ticket?</h2><p className="mt-3 text-slate-600">Stai per eliminare definitivamente <strong>{deleting.title}</strong> e i dati associati.</p><div className="mt-6 flex justify-end gap-3"><button className="rounded-lg border border-slate-300 px-4 py-2" disabled={isDeleting} onClick={() => setDeleting(null)} type="button">Annulla</button><button className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isDeleting} onClick={() => void deleteTicket()} type="button">{isDeleting ? "Eliminazione..." : "Elimina"}</button></div></div></div>}
        </div>
      </main>
    </div>
  );
}
