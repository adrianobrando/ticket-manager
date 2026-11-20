"use client";

import { useState } from "react";

export default function SentryTestButton() {
  const [triggered, setTriggered] = useState(false);

  return (
    <div>
      <button
        className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        onClick={() => {
          setTriggered(true);
          throw new Error("Errore di test da codice applicativo");
        }}
        type="button"
      >
        Test Sentry
      </button>
      {triggered && (
        <p className="mt-2 text-sm text-slate-600" role="status">
          Errore di test generato. Controlla la console del browser e Sentry.
        </p>
      )}
    </div>
  );
}
