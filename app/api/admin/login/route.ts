import { NextResponse } from "next/server";
import { jsonError, readJsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    return NextResponse.json({ error: "ADMIN_PASSWORD non configurata" }, { status: 503 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  if (typeof body.data.password !== "string" || body.data.password !== configuredPassword) {
    return jsonError("Password admin non valida", 401);
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set("admin_session", configuredPassword, {
    httpOnly: true,
    maxAge: 86_400,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
