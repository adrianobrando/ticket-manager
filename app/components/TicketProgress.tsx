import React from "react";
import { Badge } from "@/app/components/ui";
import { calcolaPercentuale } from "@/lib/calcola-percentuale";

type Stato = "todo" | "in_progress" | "review" | "done";

export function TicketProgress({
  oreStimate,
  oreConsuntivate,
  stato,
}: {
  oreStimate: number | null;
  oreConsuntivate: number;
  stato: Stato;
}) {
  // Badge labels and styles
  const statusMap: Record<Stato, { label: string; className: string }> = {
    todo: { label: "Da iniziare", className: "bg-slate-100 text-slate-700" },
    in_progress: { label: "In corso", className: "bg-blue-100 text-blue-700" },
    review: { label: "In revisione", className: "bg-yellow-100 text-yellow-800" },
    done: { label: "Completato", className: "bg-emerald-100 text-emerald-800" },
  };

  const status = statusMap[stato];

  // If no valid estimate, only show badge
  const hasEstimate = oreStimate != null && oreStimate > 0;
  if (!hasEstimate) {
    return <Badge className={`${status.className}`}>{status.label}</Badge>;
  }

  // Calculate percentage using shared logic
  const percent = calcolaPercentuale(oreStimate as number, oreConsuntivate, stato);

  // Detect overrun (only when not done)
  const overrun = stato !== "done" && oreStimate != null && oreConsuntivate > oreStimate;

  // When overrun, show bar at 95% and special text
  const displayPercent = overrun ? 95 : percent ?? 0;

  // Choose bar color: green when done, blue otherwise, red if overrun
  const barColor =
    stato === "done" ? "bg-emerald-600" : overrun ? "bg-red-500" : "bg-blue-600";

  // Format hours (match existing project: two decimals)
  const formatHours = (v: number) => (Math.round(v * 100) / 100).toFixed(2);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <Badge className={`${status.className}`}>{status.label}</Badge>
        {/* also show percent numeric to the right when available */}
        {typeof displayPercent === "number" && (
          <div className="text-sm font-semibold text-slate-600">{displayPercent}%</div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${displayPercent}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={displayPercent}
        />
      </div>

      {/* Text below the bar */}
      <div className="text-sm text-slate-600">
        {overrun ? (
          <span className="font-semibold text-red-700">Stima superata – in corso</span>
        ) : (
          <span>
            {formatHours(oreConsuntivate)}h su {formatHours(oreStimate as number)}h stimate ({displayPercent}%)
          </span>
        )}
      </div>
    </div>
  );
}
