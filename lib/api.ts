import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJsonBody(request: Request): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; response: NextResponse }
> {
  try {
    const data = await request.json();
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, response: jsonError("Il body deve essere un oggetto JSON", 400) };
    }
    return { ok: true, data: data as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonError("JSON non valido", 400) };
  }
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`Il campo "${field}" è obbligatorio`);
  }
  return value.trim();
}

export function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError("Valore stringa non valido");
  }
  return value.trim();
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof ValidationError) {
    return jsonError(error.message, 400);
  }
  if (error instanceof ZodError) {
    return jsonError(
      error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; "),
      400,
    );
  }
  console.error(error);
  return jsonError("Errore interno del server", 500);
}
