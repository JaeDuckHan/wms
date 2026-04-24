import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { AUTH_COOKIE_KEY } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3100";
const ALLOWED_ROOT_SEGMENTS = new Set([
  "auth",
  "billing",
  "clients",
  "inbound-items",
  "inbound-orders",
  "outbound-items",
  "outbound-orders",
  "product-lots",
  "products",
  "stock-balances",
  "stock-transactions",
  "warehouses",
]);

function buildSessionCookie(token: string, protocol: string) {
  const secureAttr = protocol === "https:" ? "; Secure" : "";
  return `${AUTH_COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=28800; HttpOnly; SameSite=Lax${secureAttr}`;
}

function buildExpiredSessionCookie(protocol: string) {
  const secureAttr = protocol === "https:" ? "; Secure" : "";
  return `${AUTH_COOKIE_KEY}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureAttr}`;
}

function isAllowedProxyPath(path: string[]) {
  if (path.length === 0) return false;
  return ALLOWED_ROOT_SEGMENTS.has(path[0]);
}

function isSameOriginMutation(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") return true;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

async function forward(request: NextRequest, params: { path: string[] }) {
  if (!isAllowedProxyPath(params.path)) {
    return Response.json({ ok: false, message: "Proxy path is not allowed." }, { status: 404 });
  }

  if (!isSameOriginMutation(request)) {
    return Response.json({ ok: false, message: "Cross-origin request rejected." }, { status: 403 });
  }

  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value;
  const joinedPath = params.path.join("/");
  const query = request.nextUrl.search || "";
  const target = `${API_BASE_URL}/${joinedPath}${query}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const response = await fetch(target, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });

  const text = await response.text();
  const resHeaders = new Headers({
    "content-type": response.headers.get("content-type") ?? "application/json",
  });

  // On successful login, also set server cookie so next SSR/RSC requests always see token.
  if (joinedPath === "auth/login" && response.ok) {
    try {
      const parsed = JSON.parse(text) as { data?: { token?: string } };
      const sessionToken = parsed?.data?.token;
      if (sessionToken) {
        resHeaders.append("set-cookie", buildSessionCookie(sessionToken, request.nextUrl.protocol));
      }
    } catch {
      // ignore malformed JSON
    }
  }

  if (joinedPath === "auth/logout") {
    resHeaders.append("set-cookie", buildExpiredSessionCookie(request.nextUrl.protocol));
  }

  return new Response(text, {
    status: response.status,
    headers: resHeaders,
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(request, await ctx.params);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(request, await ctx.params);
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(request, await ctx.params);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(request, await ctx.params);
}
