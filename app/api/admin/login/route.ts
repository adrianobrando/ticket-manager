import { NextResponse } from "next/server";
import { jsonError, readJsonBody } from "@/lib/api";
import {
  createAdminSession,
  isLoginRateLimited,
  recordLoginAttempt,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (isLoginRateLimited(request)) {
    return jsonError("Troppi tentativi. Riprova tra qualche minuto.", 429);
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  if (typeof body.data.password !== "string" || !verifyAdminPassword(body.data.password)) {
    recordLoginAttempt(request, false);
    return jsonError("Password admin non valida", 401);
  }

  const session = createAdminSession();
  if (!session) return jsonError("Configurazione admin non valida", 503);
  recordLoginAttempt(request, true);

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
