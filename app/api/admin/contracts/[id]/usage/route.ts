import { handleRouteError, jsonError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const { id } = await context.params;
    const contract = await prisma.clientContract.findUnique({
      where: { id },
      select: { id: true, type: true, monthlyHoursIncluded: true, name: true, startDate: true, endDate: true },
    });
    if (!contract) return jsonError("Contratto non trovato", 404);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const effectiveFrom = contract.startDate > from ? contract.startDate : from;
    const contractEnd = contract.endDate
      ? new Date(contract.endDate.getFullYear(), contract.endDate.getMonth(), contract.endDate.getDate() + 1)
      : to;
    const effectiveTo = contractEnd < to ? contractEnd : to;
    const aggregate = await prisma.timeEntry.aggregate({
      where: {
        date: { gte: effectiveFrom, lt: effectiveTo },
        OR: [
          { contractId: id },
          { contractId: null, ticket: { contractId: id } },
        ],
      },
      _sum: { durationHours: true },
    });
    const included = contract.monthlyHoursIncluded ?? 0;
    const registered = aggregate._sum.durationHours ?? 0;
    return Response.json({
      ...contract,
      includedHours: included,
      registeredHours: registered,
      remainingHours: included - registered,
      overage: Math.max(0, registered - included),
      exceeded: registered > included,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
