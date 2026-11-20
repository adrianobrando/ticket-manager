import Link from "next/link";
import { Badge } from "@/app/components/ui";

export default function Home() {
  return (
    <main className="home-canvas min-h-screen bg-slate-100 px-5 py-6 text-slate-900 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <nav
          aria-label="Navigazione principale"
          className="mx-auto mb-14 flex max-w-3xl flex-col gap-2 rounded-2xl border border-white/10 bg-white/60 px-4 py-3 shadow-sm sm:mb-20 sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:py-2"
        >
          <Link className="flex items-center gap-2 font-medium text-slate-800" href="/">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-500" />
            Ticket Manager
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <Link
              className="whitespace-nowrap rounded-lg px-2 py-2 text-xs text-slate-400 transition hover:text-slate-800 sm:px-3 sm:text-sm"
              href="/admin"
            >
              Area amministrazione
            </Link>
            <Link
              className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 sm:px-4 sm:text-sm"
              href="/new"
            >
              Nuova richiesta
            </Link>
          </div>
        </nav>

        <header className="home-hero overflow-hidden rounded-2xl px-6 py-12 text-center sm:px-12 sm:py-16">
          <Badge className="border border-blue-500/30 bg-blue-50 text-slate-200">
            Supporto, senza perdere il filo
          </Badge>
          <h1 className="mx-auto mt-6 max-w-3xl text-2xl leading-tight tracking-tight sm:text-5xl">
            Gestisci le richieste con{" "}
            <span className="home-accent">chiarezza</span> e continuità.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Invia una richiesta, ricevi il link di tracking e segui ogni
            aggiornamento in un unico posto.
          </p>
          <Link
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-blue-700"
            href="/new"
          >
            Crea un ticket
          </Link>
        </header>

        <section aria-label="Come funziona" className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-6">
          <article className="border-t border-slate-200 pt-5">
            <p className="font-mono text-sm text-blue-600">01</p>
            <h2 className="mt-4 text-lg">Invia la richiesta</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Compila il form pubblico con tutti i dettagli necessari.
            </p>
          </article>
          <article className="border-t border-slate-200 pt-5">
            <p className="font-mono text-sm text-blue-600">02</p>
            <h2 className="mt-4 text-lg">Ricevi il tracking</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Usa il link personale per controllare stato, scadenza e commenti.
            </p>
          </article>
          <article className="border-t border-slate-200 pt-5">
            <p className="font-mono text-sm text-blue-600">03</p>
            <h2 className="mt-4 text-lg">Segui gli aggiornamenti</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Il team pianifica il lavoro e ti notifica i cambi di stato.
            </p>
          </article>
        </section>

        <footer className="mt-14 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
          Hai già un token? Apri direttamente il link ricevuto per vedere il tuo ticket.
        </footer>
      </div>
    </main>
  );
}
