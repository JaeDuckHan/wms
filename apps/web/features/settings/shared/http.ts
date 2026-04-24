import { ApiError } from "@/features/outbound/api";
import { shouldUseImplicitFallback, shouldUseMockMode } from "@/lib/runtime-mode";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3100";

type JsonResponse<T> = { ok: boolean; data?: T; message?: string };

export type RequestOptions = { token?: string };
type AuthRequestOptions = RequestOptions & { allowAnonymous?: boolean };

function isBrowserRequest() {
  return typeof window !== "undefined";
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveToken(input?: string): Promise<string | undefined> {
  if (input) return input;
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
  const browser = isBrowserRequest();
  const token = await resolveToken(options?.token);
  if (!browser && !token && !options?.allowAnonymous) throw new ApiError("Missing auth token", 401);

  const endpoint = browser ? `/api/proxy${path}` : `${API_BASE_URL}${path}`;
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(!browser && token ? { Authorization: `Bearer ${token}` } : {}),
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
  const browser = isBrowserRequest();
  const token = await resolveToken(options?.token);
  if (!browser && !token && !options?.allowAnonymous) throw new ApiError("Missing auth token", 401);

  const endpoint = browser ? `/api/proxy${path}` : `${API_BASE_URL}${path}`;
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(!browser && token ? { Authorization: `Bearer ${token}` } : {}),
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
