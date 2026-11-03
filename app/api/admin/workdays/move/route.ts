import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { calculateSchedule } from "@/lib/scheduler";

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

    const existing = await prisma.workDay.findUnique({ where: { date_ticketId: { date: oldDate, ticketId } } });
    const plannedHours = existing?.plannedHours ?? Number(body.plannedHours);
    if (!Number.isFinite(plannedHours) || plannedHours <= 0) return jsonError("Ore pianificate non valide", 400);

    if (oldDate.getTime() !== newDate.getTime()) {
      await prisma.$transaction(async (tx) => {
        if (existing) await tx.workDay.delete({ where: { id: existing.id } });
        // Il vincolo unico [date, ticketId] impone il merge se il giorno di arrivo esiste già
        await tx.workDay.upsert({
          where: { date_ticketId: { date: newDate, ticketId } },
          create: { date: newDate, ticketId, plannedHours, isPinned: pin },
          update: { plannedHours: { increment: plannedHours }, isPinned: pin },
        });
      });
    }

    await calculateSchedule();
    return NextResponse.json({ success: true, wasPinned: existing?.isPinned ?? false, plannedHours });
  } catch (error) {
    return handleRouteError(error);
  }
}
