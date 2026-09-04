import Link from "next/link";
import { Badge, Card } from "@/app/components/ui";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-3xl bg-slate-950 px-6 py-12 text-white shadow-xl sm:px-12 sm:py-16">
          <Badge className="bg-blue-500/20 text-blue-200">Ticket Manager</Badge>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Gestisci le richieste in modo semplice e trasparente.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Invia una richiesta, ricevi il link di tracking e segui ogni
            aggiornamento in un unico posto.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="rounded-lg bg-blue-500 px-5 py-3 text-center font-semibold text-white transition hover:bg-blue-400"
              href="/new"
            >
              Crea un ticket
            </Link>
            <Link
              className="rounded-lg border border-slate-600 px-5 py-3 text-center font-semibold text-slate-200 transition hover:bg-slate-800"
              href="/admin"
            >
              Area amministrazione
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <div className="text-2xl">01</div>
            <h2 className="mt-4 text-lg font-semibold">Invia la richiesta</h2>
            <p className="mt-2 text-slate-600">
              Compila il form pubblico con tutti i dettagli necessari.
            </p>
          </Card>
          <Card className="p-6">
            <div className="text-2xl">02</div>
            <h2 className="mt-4 text-lg font-semibold">Ricevi il tracking</h2>
            <p className="mt-2 text-slate-600">
              Usa il link personale per controllare stato, scadenza e commenti.
            </p>
          </Card>
          <Card className="p-6">
            <div className="text-2xl">03</div>
            <h2 className="mt-4 text-lg font-semibold">Segui gli aggiornamenti</h2>
            <p className="mt-2 text-slate-600">
              Il team pianifica il lavoro e ti notifica i cambi di stato.
            </p>
          </Card>
        </section>

        <footer className="mt-10 text-center text-sm text-slate-500">
          Hai già un token? Apri direttamente il link ricevuto per vedere il tuo ticket.
        </footer>
      </div>
    </main>
  );
}
