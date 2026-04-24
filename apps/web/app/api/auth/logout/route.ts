import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_KEY } from "@/lib/auth";

function buildExpiredSessionCookie(protocol: string) {
  const secureAttr = protocol === "https:" ? "; Secure" : "";
  return `${AUTH_COOKIE_KEY}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureAttr}`;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.headers.append("set-cookie", buildExpiredSessionCookie(request.nextUrl.protocol));
  return response;
}
