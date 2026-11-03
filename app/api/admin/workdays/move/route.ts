import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { calculateSchedule } from "@/lib/scheduler";

process.env.TZ = "Europe/Rome";

export const runtime = "nodejs";

// Stessa convenzione di /api/admin/diary: mezzanotte locale da YYYY-MM-DD
function parseDay(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const body = await request.json();
    const oldDate = parseDay(body?.oldDate);
    const newDate = parseDay(body?.newDate);
    if (typeof body?.ticketId !== "string" || !oldDate || !newDate) return jsonError("Dati non validi", 400);
    const ticketId: string = body.ticketId;
    // pin=false è usato dall'annulla per restituire il giorno alla pianificazione automatica
    const pin = body.pin !== false;

    // Ricerca per intervallo di giorno, non per timestamp esatto: tollera righe scritte con fusi orari diversi
    const dayEnd = (d: Date) => {
      const e = new Date(d);
      e.setDate(e.getDate() + 1);
      return e;
    };
    const existingRows = await prisma.workDay.findMany({
      where: { ticketId, date: { gte: oldDate, lt: dayEnd(oldDate) } },
    });
    const existing = existingRows[0];
    const plannedHours = existingRows.length
      ? existingRows.reduce((sum, row) => sum + row.plannedHours, 0)
      : Number(body.plannedHours);
    if (!Number.isFinite(plannedHours) || plannedHours <= 0) return jsonError("Ore pianificate non valide", 400);

    if (oldDate.getTime() !== newDate.getTime()) {
      await prisma.$transaction(async (tx) => {
        await tx.workDay.deleteMany({ where: { id: { in: existingRows.map((row) => row.id) } } });
        // Se il giorno di arrivo esiste già si fa il merge, altrimenti si crea
        const target = await tx.workDay.findFirst({
          where: { ticketId, date: { gte: newDate, lt: dayEnd(newDate) } },
        });
        if (target) {
          await tx.workDay.update({
            where: { id: target.id },
            data: { plannedHours: { increment: plannedHours }, isPinned: pin },
          });
        } else {
          await tx.workDay.create({ data: { date: newDate, ticketId, plannedHours, isPinned: pin } });
        }
      });
    }

    await calculateSchedule();
    return NextResponse.json({ success: true, wasPinned: existing?.isPinned ?? false, plannedHours });
  } catch (error) {
    return handleRouteError(error);
  }
}
