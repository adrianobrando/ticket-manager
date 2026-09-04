import { handleRouteError, jsonError, readJsonBody, ValidationError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { contractSchema } from "@/lib/validation";

function parseDate(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) throw new ValidationError("Formato data non valido");
  return date;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { id } = await context.params;
    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const input = contractSchema.partial().parse(body.data);
    const existing = await prisma.clientContract.findUnique({ where: { id } });
    if (!existing) return jsonError("Contratto non trovato", 404);
    const type = input.type ?? existing.type;
    const monthlyHoursIncluded = input.monthlyHoursIncluded === undefined
      ? existing.monthlyHoursIncluded
      : input.monthlyHoursIncluded;
    if (type === "RETAINER" && monthlyHoursIncluded == null) {
      return jsonError("monthlyHoursIncluded è obbligatorio per i contratti retainer", 400);
    }

    const contract = await prisma.clientContract.update({
      where: { id },
      data: {
        ...input,
        ...(input.startDate !== undefined ? { startDate: parseDate(input.startDate) } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate ? parseDate(input.endDate) : null } : {}),
        monthlyHoursIncluded: type === "RETAINER" ? monthlyHoursIncluded : null,
      },
      include: { client: true },
    });
    return Response.json(contract);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { id } = await context.params;
    const existing = await prisma.clientContract.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return jsonError("Contratto non trovato", 404);
    await prisma.$transaction([
      prisma.ticket.updateMany({ where: { contractId: id }, data: { contractId: null } }),
      prisma.timeEntry.updateMany({ where: { contractId: id }, data: { contractId: null } }),
      prisma.clientContract.delete({ where: { id } }),
    ]);
    return Response.json({ deleted: true, id });
  } catch (error) {
    return handleRouteError(error);
  }
}
