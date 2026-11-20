"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import AdminPageShell from "@/app/admin/AdminPageShell";

type ReportEntry = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  note: string | null;
  ticket: { id: string; title: string; description: string };
};
type Report = {
  contract: { name: string; client: { name: string }; tickets: { id: string; title: string }[] } | null;
  ticket: { title: string; client: { name: string } } | null;
  tickets: { id: string; title: string }[];
  timeEntries: ReportEntry[];
  workLogs: (Omit<ReportEntry, "durationHours" | "note"> & { duration: number; notes: string | null })[];
  totalHours: number;
};

const dateKey = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
const monthRange = (offset: number) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: dateKey(start), to: dateKey(end) };
};
const formatDate = (value: string) => new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
const formatTime = (value: string) => new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const monthLabel = (date: Date) => {
  const label = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const PIE_COLORS = ["#9382ff", "#7666ff", "#5046e4", "#b7a4fb", "#a8a6b7", "#918ea0", "#54525f", "#ddd6ff"];
const DEADLINE_COLORS: Record<string, string> = { HARD: "#9382ff", SOFT: "#5046e4", NONE: "#54525f" };
type ChartPoint = { name: string; value: number };

const OTHERS_COLOR = "#54525f";

// Oltre 6 voci: prime 5 per valore + "Altri" con la somma del resto.
function groupTopFive(data: ChartPoint[]): ChartPoint[] {
  if (data.length <= 6) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const others = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
  return [...sorted.slice(0, 5), { name: "Altri", value: Math.round(others * 100) / 100 }];
}

function PieCard({ title, data, format, colorFor }: { title: string; data: ChartPoint[]; format: (v: number) => string; colorFor?: (name: string, i: number) => string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayData = isExpanded ? data : groupTopFive(data);
  const canRegroup = isExpanded && data.length > 6;
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {canRegroup && (
          <button className="text-xs font-semibold text-blue-600 hover:underline" onClick={() => setIsExpanded(false)} type="button">↩ Raggruppa di nuovo</button>
        )}
      </div>
      <div className="mt-4 h-96">
        {displayData.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">Nessun dato per questo periodo</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
              <Pie
                data={displayData}
                dataKey="value"
                nameKey="name"
                innerRadius="40%"
                outerRadius="70%"
                onClick={(entry) => { if (entry?.name === "Altri" && !isExpanded) setIsExpanded(true); }}
                style={{ cursor: "pointer" }}
              >
                {displayData.map((entry, i) => <Cell key={entry.name} fill={entry.name === "Altri" ? OTHERS_COLOR : colorFor ? colorFor(entry.name, i) : PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => format(Number(value))} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const contractId = searchParams.get("contractId");
  const ticketId = searchParams.get("ticketId");
  const current = useMemo(() => monthRange(0), []);
  const [period, setPeriod] = useState("current");
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);
  const [selectedTicket, setSelectedTicket] = useState(ticketId ?? "");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chartData, setChartData] = useState<any>(null);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);

  async function load() {
    const query = new URLSearchParams({ from, to });
    if (contractId) query.set("contractId", contractId);
    if (selectedTicket) query.set("ticketId", selectedTicket);
    const response = await fetch(`/api/admin/reports?${query}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Caricamento report non riuscito.");
    setReport(data);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Caricamento report non riuscito."));
    }, 0);
    return () => window.clearTimeout(timer);
    // Load once for the selected report context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, selectedTicket, contractId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => setIsLoadingCharts(true), 0);
    fetch(`/api/admin/reports/charts?${new URLSearchParams({ from, to })}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setChartData(data))
      .catch((e) => { if (e?.name !== "AbortError") setChartData(null); })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingCharts(false); });
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [from, to]);

  function selectPeriod(value: string) {
    setPeriod(value);
    if (value === "current") {
      const range = monthRange(0);
      setFrom(range.from);
      setTo(range.to);
    } else if (value === "previous") {
      const range = monthRange(-1);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  // Sposta il mese visualizzato e riallinea l'intervallo che alimenta la tabella.
  function goToMonth(date: Date) {
    const month = startOfMonth(date);
    const today = startOfMonth(new Date());
    setCurrentMonth(month);
    setFrom(dateKey(month));
    setTo(dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)));
    setPeriod(month.getTime() === today.getTime() ? "current" : "custom");
  }

  const title = report?.contract?.name ?? report?.ticket?.title ?? "Report ore lavorate";
  const clientName = report?.contract?.client.name ?? report?.ticket?.client.name;
  const activities = report
    ? [
        ...report.timeEntries.map((entry) => ({ ...entry, source: "TimeEntry" as const })),
        ...report.workLogs.map((entry) => ({
          ...entry,
          durationHours: entry.duration,
          note: entry.notes,
          source: "WorkLog" as const,
        })),
      ].sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime() ||
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      )
    : [];

  return (
    <AdminPageShell activePage="reports" title="Report ore lavorate">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 print:block">
          <div><p className="text-sm font-semibold uppercase tracking-widest text-blue-600 print:text-black">Report ore lavorate</p><h1 className="mt-1 text-3xl font-bold">{title}</h1>{clientName && <p className="mt-1 text-slate-600">Cliente: {clientName}</p>}</div>
          <div className="text-right print:hidden">
            <button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white" onClick={() => window.print()} type="button">Anteprima PDF</button>
            <p className="mt-2 max-w-xs text-xs text-slate-500">Nell’anteprima del browser puoi stampare il report o scegliere &quot;Salva come PDF&quot;.</p>
          </div>
        </header>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm print:hidden">
          <h2 aria-live="polite" className="text-xl font-semibold">{monthLabel(currentMonth)}</h2>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={() => goToMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} type="button">← Mese prec.</button>
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={() => goToMonth(new Date())} type="button">Mese corrente</button>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={() => goToMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} type="button">Mese succ. →</button>
          </div>
        </section>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 print:hidden">
          {isLoadingCharts && !chartData ? (
            ["Ore lavorate per Cliente", "Fatturato stimato per Cliente", "Distribuzione tipo scadenza"].map((t) => (
              <section className="rounded-2xl bg-white p-6 shadow-sm" key={t}>
                <h2 className="text-lg font-semibold">{t}</h2>
                <div className="mt-4 flex h-64 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">Grafico in caricamento...</div>
              </section>
            ))
          ) : (
            <>
              <PieCard title="Ore lavorate per Cliente" data={chartData?.orePerCliente ?? []} format={(v) => `${v.toFixed(2)} ore`} />
              <PieCard title="Fatturato stimato per Cliente" data={chartData?.fatturatoPerCliente ?? []} format={(v) => `€ ${v.toFixed(2)}`} />
              <PieCard title="Distribuzione tipo scadenza" data={chartData?.distribuzioneScadenze ?? []} format={(v) => `${v.toFixed(2)} ore`} colorFor={(name, i) => DEADLINE_COLORS[name] ?? PIE_COLORS[i]} />
            </>
          )}
        </div>
        <section className="rounded-2xl bg-white p-5 shadow-sm print:hidden">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-medium">Periodo<select className="mt-2 block rounded-lg border px-3 py-2" onChange={(event) => selectPeriod(event.target.value)} value={period}><option value="current">Mese corrente</option><option value="previous">Mese scorso</option><option value="custom">Personalizzato</option></select></label>
            <label className="text-sm font-medium">Da<input className="mt-2 block rounded-lg border px-3 py-2" disabled={period !== "custom"} onChange={(event) => setFrom(event.target.value)} type="date" value={from} /></label>
            <label className="text-sm font-medium">A<input className="mt-2 block rounded-lg border px-3 py-2" disabled={period !== "custom"} onChange={(event) => setTo(event.target.value)} type="date" value={to} /></label>
            <label className="text-sm font-medium">Ticket<select className="mt-2 block max-w-xs rounded-lg border px-3 py-2" onChange={(event) => setSelectedTicket(event.target.value)} value={selectedTicket}><option value="">Tutti i ticket</option>{(report?.tickets ?? []).map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.title}</option>)}</select></label>
          </div>
          {error && <p className="mt-4 text-red-700">{error}</p>}
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          <div className="flex justify-between gap-4 border-b border-slate-200 pb-4"><div><h2 className="text-xl font-semibold">Attività registrate</h2><p className="text-sm text-slate-500">Periodo: {formatDate(`${from}T12:00:00`)} – {formatDate(`${to}T12:00:00`)}</p></div><strong className="text-lg">{report?.totalHours.toFixed(2) ?? "0.00"} h totali</strong></div>
          <div className="overflow-x-auto"><table className="mt-4 w-full text-left text-sm"><thead><tr className="border-b border-slate-200"><th className="py-3 pr-3">Data</th><th className="py-3 pr-3">Tipo</th><th className="py-3 pr-3">Ticket</th><th className="py-3 pr-3">Descrizione</th><th className="py-3 pr-3">Inizio</th><th className="py-3 pr-3">Fine</th><th className="py-3 text-right">Durata</th></tr></thead><tbody>{activities.map((entry) => <tr className="border-b border-slate-100 align-top" key={`${entry.source}-${entry.id}`}><td className="py-3 pr-3 whitespace-nowrap">{formatDate(entry.date)}</td><td className="py-3 pr-3">{entry.source}</td><td className="py-3 pr-3">{entry.ticket.title}</td><td className="py-3 pr-3">{entry.note || entry.ticket.description}</td><td className="py-3 pr-3 whitespace-nowrap">{formatTime(entry.startTime)}</td><td className="py-3 pr-3 whitespace-nowrap">{formatTime(entry.endTime)}</td><td className="py-3 text-right whitespace-nowrap">{entry.durationHours.toFixed(2)} h</td></tr>)}</tbody></table></div>
          {report && activities.length === 0 && <p className="py-6 text-sm text-slate-500">Nessuna attività registrata nel periodo.</p>}
        </section>
      </div>
    </AdminPageShell>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<AdminPageShell activePage="reports" title="Report ore lavorate"><p>Caricamento report...</p></AdminPageShell>}>
      <ReportsContent />
    </Suspense>
  );
}
