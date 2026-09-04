import { handleRouteError } from "@/lib/api";
import { requireAdminPassword } from "@/lib/admin-auth";
import { calculateSchedule } from "@/lib/scheduler";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const authError = requireAdminPassword(request);
    if (authError) return authError;
    const tickets = await calculateSchedule();
    return NextResponse.json(tickets);
  } catch (error) {
    return handleRouteError(error);
  }
}
