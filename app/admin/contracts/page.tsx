"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Client = { id: string; name: string; email: string };
type Contract = {
  id: string;
  clientId: string;
  name: string;
  type: "RETAINER" | "HOURLY";
  hourlyRate: number;
  monthlyHoursIncluded: number | null;
  startDate: string;
  endDate: string | null;
  registeredHours: number;
  remainingHours: number;
  client: Client;
};

export default function ContractsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    const data = await response.json();
    if (response.status === 401) throw new Error("AUTH_REQUIRED");
    if (!response.ok) throw new Error(data.error || "Operazione non riuscita.");
    return data;
  }

  async function load() {
    setError("");
    try {
      const [ticketResult, contractResult] = await Promise.all([
        request("/api/admin/tickets?page=1&pageSize=100"),
        request("/api/admin/contracts"),
      ]);
      const uniqueClients = new Map<string, Client>();
      ticketResult.tickets.forEach((ticket: { client: Client }) => uniqueClients.set(ticket.client.id, ticket.client));
      setClients([...uniqueClients.values()]);
      setContracts(contractResult.contracts);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "AUTH_REQUIRED") {
        router.replace("/admin/login");
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Caricamento non riuscito.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
    // Initial client load should run once when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await request(editing ? `/api/admin/contracts/${editing.id}` : "/api/admin/contracts", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          clientId: data.get("clientId"),
          name: data.get("name"),
          type: data.get("type"),
          monthlyHoursIncluded: data.get("type") === "RETAINER" ? Number(data.get("monthlyHoursIncluded")) : null,
          hourlyRate: Number(data.get("hourlyRate")),
          startDate: data.get("startDate"),
          endDate: data.get("endDate") || null,
        }),
      });
      form.reset();
      setEditing(null);
      await load();
      setMessage(editing ? "Contratto aggiornato." : "Contratto creato.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Creazione non riuscita.");
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Eliminare questo contratto?")) return;
    if (isDeleting) return;
    setIsDeleting(true);
    setError("");
    setMessage("");
    try {
      await request(`/api/admin/contracts/${id}`, { method: "DELETE" });
      if (editing?.id === id) setEditing(null);
      await load();
      setMessage("Contratto eliminato.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Eliminazione non riuscita.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
      <form className="space-y-4 rounded-2xl bg-white p-6 shadow-sm" key={editing?.id ?? "new"} onSubmit={save}>
        <h1 className="text-2xl font-bold">{editing ? "Modifica contratto" : "Nuovo contratto"}</h1>
        {message && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}
        <label className="block text-sm font-medium">Cliente<select className="mt-2 w-full rounded-lg border px-3 py-2.5" defaultValue={editing?.clientId ?? ""} name="clientId" required><option value="">Seleziona cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.email})</option>)}</select></label>
        <label className="block text-sm font-medium">Nome<input className="mt-2 w-full rounded-lg border px-3 py-2.5" defaultValue={editing?.name ?? ""} name="name" required /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Tipo<select className="mt-2 w-full rounded-lg border px-3 py-2.5" defaultValue={editing?.type ?? "RETAINER"} name="type"><option value="RETAINER">Retainer</option><option value="HOURLY">A ore</option></select></label>
          <label className="block text-sm font-medium">Ore mensili<input className="mt-2 w-full rounded-lg border px-3 py-2.5" defaultValue={editing?.monthlyHoursIncluded ?? ""} min="0" name="monthlyHoursIncluded" step="0.01" type="number" /></label>
          <label className="block text-sm font-medium">Tariffa oraria<input className="mt-2 w-full rounded-lg border px-3 py-2.5" defaultValue={editing?.hourlyRate ?? ""} min="0" name="hourlyRate" required step="0.01" type="number" /></label>
          <label className="block text-sm font-medium">Inizio<input className="mt-2 w-full rounded-lg border px-3 py-2.5" defaultValue={editing?.startDate.slice(0, 10) ?? ""} name="startDate" required type="date" /></label>
          <label className="block text-sm font-medium">Fine<input className="mt-2 w-full rounded-lg border px-3 py-2.5" defaultValue={editing?.endDate?.slice(0, 10) ?? ""} name="endDate" type="date" /></label>
        </div>
        <div className="flex gap-3"><button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Salvataggio..." : editing ? "Salva modifiche" : "Crea contratto"}</button>{editing && <button className="rounded-lg border border-slate-300 px-5 py-3 font-semibold" disabled={isSaving} onClick={() => setEditing(null)} type="button">Annulla</button>}</div>
      </form>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Contratti esistenti</h2>
        <div className="mt-4 divide-y divide-slate-200">{contracts.length === 0 ? <p className="text-sm text-slate-500">Nessun contratto.</p> : contracts.map((contract) => <div className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0" key={contract.id}><div><p className="font-semibold">{contract.name}</p>{contract.type === "RETAINER" ? <p className="text-sm text-slate-500">{contract.client.name} · {contract.hourlyRate.toFixed(2)} €/h</p> : <p className="text-sm text-slate-500">{contract.client.name} · {contract.hourlyRate.toFixed(2)} €/h · {contract.registeredHours.toFixed(2)} h registrate questo mese</p>}{contract.type === "RETAINER" && <p className="mt-1 text-sm"><span className="font-medium">Incluse mensili:</span> {contract.monthlyHoursIncluded?.toFixed(2) ?? "0.00"} h · <span className="font-medium">Consumate questo mese:</span> {contract.registeredHours.toFixed(2)} h · <span className="font-medium">Rimanenti questo mese:</span> {contract.remainingHours.toFixed(2)} h</p>}</div><div className="flex gap-3"><button className="text-sm font-medium text-blue-700" disabled={isDeleting} onClick={() => setEditing(contract)} type="button">Modifica</button><button className="text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={isDeleting} onClick={() => void remove(contract.id)} type="button">{isDeleting ? "Eliminazione..." : "Elimina"}</button></div></div>)}</div>
      </section>
      </div>
    </main>
  );
}
