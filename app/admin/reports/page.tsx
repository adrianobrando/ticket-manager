"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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

  const title = report?.contract?.name ?? report?.ticket?.title ?? "Report ore lavorate";
  const clientName = report?.contract?.client.name ?? report?.ticket?.client.name;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 print:block">
          <div><p className="text-sm font-semibold uppercase tracking-widest text-blue-600 print:text-black">Report ore lavorate</p><h1 className="mt-1 text-3xl font-bold">{title}</h1>{clientName && <p className="mt-1 text-slate-600">Cliente: {clientName}</p>}</div>
          <button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white print:hidden" onClick={() => window.print()} type="button">Stampa report</button>
        </header>
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
          <div className="overflow-x-auto"><table className="mt-4 w-full text-left text-sm"><thead><tr className="border-b border-slate-200"><th className="py-3 pr-3">Data</th><th className="py-3 pr-3">Ticket</th><th className="py-3 pr-3">Descrizione</th><th className="py-3 pr-3">Inizio</th><th className="py-3 pr-3">Fine</th><th className="py-3 text-right">Durata</th></tr></thead><tbody>{report?.timeEntries.map((entry) => <tr className="border-b border-slate-100 align-top" key={entry.id}><td className="py-3 pr-3 whitespace-nowrap">{formatDate(entry.date)}</td><td className="py-3 pr-3">{entry.ticket.title}</td><td className="py-3 pr-3">{entry.note || entry.ticket.description}</td><td className="py-3 pr-3 whitespace-nowrap">{formatTime(entry.startTime)}</td><td className="py-3 pr-3 whitespace-nowrap">{formatTime(entry.endTime)}</td><td className="py-3 text-right whitespace-nowrap">{entry.durationHours.toFixed(2)} h</td></tr>)}</tbody></table></div>
          {report && report.timeEntries.length === 0 && <p className="py-6 text-sm text-slate-500">Nessuna attività registrata nel periodo.</p>}
        </section>
      </div>
    </main>
  );
}

export default function ReportsPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-100 p-10 text-slate-900">Caricamento report...</main>}><ReportsContent /></Suspense>;
}
