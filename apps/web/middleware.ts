import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_KEY } from "@/lib/auth";

const protectedPrefixes = ["/dashboard", "/inbounds", "/outbounds", "/inventory", "/billing", "/settings", "/guide"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE_KEY)?.value;
  if (token) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inbounds/:path*",
    "/outbounds/:path*",
    "/inventory/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/guide/:path*",
  ],
};
