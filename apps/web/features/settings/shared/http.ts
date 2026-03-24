import { ApiError } from "@/features/outbound/api";
import { AUTH_COOKIE_KEY } from "@/lib/auth";
import { shouldUseImplicitFallback, shouldUseMockMode } from "@/lib/runtime-mode";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3100";

type JsonResponse<T> = { ok: boolean; data?: T; message?: string };

export type RequestOptions = { token?: string };
type AuthRequestOptions = RequestOptions & { allowAnonymous?: boolean };

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveToken(input?: string): Promise<string | undefined> {
  if (input) return input;
  if (typeof window !== "undefined") {
    const tokenCookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${AUTH_COOKIE_KEY}=`));
    return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : undefined;
  }
  return undefined;
}

async function parseJsonResponse<T>(response: Response): Promise<JsonResponse<T>> {
  const text = await response.text();
  if (!text.trim()) {
    return { ok: response.ok, message: response.ok ? undefined : "Empty response body" };
  }

  try {
    return JSON.parse(text) as JsonResponse<T>;
  } catch {
    return {
      ok: false,
      message: response.ok ? "Invalid JSON response" : text.slice(0, 200) || "Request failed",
    };
  }
}

export async function requestJson<T>(path: string, init?: RequestInit, options?: AuthRequestOptions): Promise<T> {
  const token = await resolveToken(options?.token);
  if (!token && !options?.allowAnonymous) throw new ApiError("Missing auth token", 401);

  const endpoint = typeof window === "undefined" ? `${API_BASE_URL}${path}` : `/api/proxy${path}`;
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = await parseJsonResponse<T>(response);
  if (!response.ok || !json.ok) throw new ApiError(json.message ?? "Request failed", response.status);
  if (json.data === undefined) throw new ApiError("Missing response data", response.status);
  return json.data;
}

export async function requestVoid(path: string, init?: RequestInit, options?: AuthRequestOptions): Promise<void> {
  const token = await resolveToken(options?.token);
  if (!token && !options?.allowAnonymous) throw new ApiError("Missing auth token", 401);

  const endpoint = typeof window === "undefined" ? `${API_BASE_URL}${path}` : `/api/proxy${path}`;
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = await parseJsonResponse<unknown>(response);
  if (!response.ok || !json.ok) {
    throw new ApiError(json.message ?? "Request failed", response.status);
  }
}

export { shouldUseImplicitFallback as shouldUseFallback, shouldUseMockMode };
