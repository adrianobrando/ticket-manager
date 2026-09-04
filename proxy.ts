import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const configuredPassword = process.env.ADMIN_PASSWORD;
  const session = request.cookies.get("admin_session")?.value;
  if (configuredPassword && session === configuredPassword) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: "/admin/:path*",
};
