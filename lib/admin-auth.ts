import { NextResponse } from "next/server";

type RequestWithCookies = Request & {
  cookies?: { get(name: string): { value: string } | undefined };
};

export function requireAdminPassword(request: Request): NextResponse | null {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD non configurata" },
      { status: 503 },
    );
  }

  const sessionCookie = (request as RequestWithCookies).cookies?.get("admin_session")?.value;
  const cookies = request.headers.get("cookie")?.split(";").reduce<Record<string, string>>((values, item) => {
    const separator = item.indexOf("=");
    if (separator === -1) return values;
    const name = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    values[name] = decodeURIComponent(value);
    return values;
  }, {});

  if (sessionCookie === configuredPassword || cookies?.admin_session === configuredPassword || request.headers.get("x-admin-password") === configuredPassword) {
    return null;
  }

  return NextResponse.json({ error: "Password admin non valida" }, { status: 401 });
}
