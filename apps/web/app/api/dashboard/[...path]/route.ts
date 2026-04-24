import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { AUTH_COOKIE_KEY } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3100";
const ALLOWED_DASHBOARD_PATHS = new Set([
  "storage",
  "storage/billing/preview",
  "storage/billing/sku-preview",
  "storage/capacity",
  "storage/snapshots/generate",
  "storage/trend",
]);

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

function isAllowedDashboardPath(path: string[]) {
  if (path.length === 0) return false;
  return ALLOWED_DASHBOARD_PATHS.has(path.join("/"));
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
  if (!isAllowedDashboardPath(params.path)) {
    return Response.json({ ok: false, message: "Dashboard path is not allowed." }, { status: 404 });
  }

  if (!isSameOriginMutation(request)) {
    return Response.json({ ok: false, message: "Cross-origin request rejected." }, { status: 403 });
  }

  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value;
  const joinedPath = params.path.join("/");
  const query = request.nextUrl.search || "";
  const target = `${API_BASE_URL}/api/dashboard/${joinedPath}${query}`;

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
  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(request, await ctx.params);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(request, await ctx.params);
}
