import { handleRouteError, jsonError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { WORK_HOURS_PER_DAY } from "@/lib/scheduler";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    const oreStimate = Number(body?.oreStimate);
    const due = new Date(body?.dueDate);
    if (!Number.isFinite(oreStimate) || oreStimate <= 0 || Number.isNaN(due.getTime())) {
      return jsonError("dueDate e oreStimate non validi", 400);
    }

    const existing = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return jsonError("Ticket non trovato", 404);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(due);
    end.setHours(23, 59, 59, 999);

    // Giorni lavorativi (lun-ven) da oggi alla scadenza inclusa
    let workingDays = 0;
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) workingDays++;
    }
    const oreDisponibili = workingDays * WORK_HOURS_PER_DAY;

    // Esclude i WorkDay del ticket stesso: verrebbero ripianificati con le nuove ore
    const agg = await prisma.workDay.aggregate({
      _sum: { plannedHours: true },
      where: { date: { gte: start, lte: end }, ticketId: { not: id } },
    });
    const oreGiaPianificate = agg._sum.plannedHours ?? 0;

    const oreMancanti = oreGiaPianificate + oreStimate - oreDisponibili;
    if (oreMancanti > 0) {
      return Response.json({
        canFit: false,
        oreMancanti: Math.round(oreMancanti * 10) / 10,
        giorniDiRitardo: Math.ceil(oreMancanti / WORK_HOURS_PER_DAY),
        oreDisponibili,
      });
    }
    return Response.json({ canFit: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
