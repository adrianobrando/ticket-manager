"use client";

export default function SentryTestButton() {
  return (
    <button
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      onClick={() => {
        throw new Error("Errore di test da codice applicativo");
      }}
      type="button"
    >
      Test Sentry
    </button>
  );
}
