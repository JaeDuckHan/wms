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
  "warehouse-locations",
  "warehouses",
]);
const DEFAULT_PROXY_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
const READ_ONLY_ROOT_SEGMENTS = new Set(["stock-balances", "stock-transactions"]);

function readForwardedValue(headerValue: string | null) {
  return String(headerValue || "")
    .split(",")[0]
    .trim();
}

function getExpectedOrigin(request: NextRequest) {
  const forwardedProto = readForwardedValue(request.headers.get("x-forwarded-proto"));
  const forwardedHost = readForwardedValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || readForwardedValue(request.headers.get("host")) || request.nextUrl.host;
  const protocol = forwardedProto || request.nextUrl.protocol.replace(/:$/, "");

  if (!host || !protocol) return null;
  return `${protocol}://${host}`;
}

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

function allowedMethodsForProxyPath(path: string[]) {
  if (!isAllowedProxyPath(path)) return [];
  if (path.length === 1 && READ_ONLY_ROOT_SEGMENTS.has(path[0])) {
    return ["GET", "HEAD", "OPTIONS"];
  }
  if (path[0] === "billing" && path[1] === "invoices" && path.length === 2) {
    return ["GET", "POST", "HEAD", "OPTIONS"];
  }
  return DEFAULT_PROXY_METHODS;
}

function isMethodAllowed(method: string, allowedMethods: string[]) {
  const normalized = method.toUpperCase();
  return allowedMethods.includes(normalized) || (normalized === "HEAD" && allowedMethods.includes("GET"));
}

function methodNotAllowedResponse(allowedMethods: string[]) {
  return Response.json(
    { ok: false, message: "Proxy method is not allowed for this path." },
    { status: 405, headers: { Allow: allowedMethods.join(", ") } }
  );
}

function isSameOriginMutation(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") return true;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const expectedOrigin = getExpectedOrigin(request);
    if (!expectedOrigin) return false;
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

async function forward(request: NextRequest, params: { path: string[] }) {
  if (!isAllowedProxyPath(params.path)) {
    return Response.json({ ok: false, message: "Proxy path is not allowed." }, { status: 404 });
  }
  const allowedMethods = allowedMethodsForProxyPath(params.path);
  if (!isMethodAllowed(request.method, allowedMethods)) {
    return methodNotAllowedResponse(allowedMethods);
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
  const contentDisposition = response.headers.get("content-disposition");
  if (contentDisposition) {
    resHeaders.set("content-disposition", contentDisposition);
  }

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

export async function OPTIONS(_request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const params = await ctx.params;
  if (!isAllowedProxyPath(params.path)) {
    return new Response(null, { status: 404 });
  }

  const allowedMethods = allowedMethodsForProxyPath(params.path);
  return new Response(null, {
    status: 204,
    headers: {
      Allow: allowedMethods.join(", "),
      "Access-Control-Allow-Methods": allowedMethods.join(", "),
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
