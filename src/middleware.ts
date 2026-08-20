import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Lapis 1 otorisasi: cek session di edge, arahkan sesuai role.
 * (Lapis 2 = requireOwner/requireKasir di server action & page;
 *  Lapis 3 = RLS Supabase — lihat supabase/rls.sql)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const loginUrl = new URL("/login", req.url);

  if (pathname === "/" || pathname === "/login") {
    if (session) {
      return NextResponse.redirect(
        new URL(session.role === "OWNER" ? "/owner/dashboard" : "/kasir/dashboard", req.url)
      );
    }
    if (pathname === "/") return NextResponse.redirect(loginUrl);
    return NextResponse.next();
  }

  if (pathname.startsWith("/owner")) {
    if (!session) return NextResponse.redirect(loginUrl);
    if (session.role !== "OWNER") return NextResponse.redirect(new URL("/kasir/dashboard", req.url));
    return NextResponse.next();
  }

  if (pathname.startsWith("/kasir")) {
    if (!session) return NextResponse.redirect(loginUrl);
    if (session.role !== "KASIR") return NextResponse.redirect(new URL("/owner/dashboard", req.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/owner/:path*", "/kasir/:path*"],
};
