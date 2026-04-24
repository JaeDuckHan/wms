import { ApiError } from "@/features/outbound/api";

type LoginPayload = {
  email: string;
  password: string;
};

type LoginResponse = {
  token: string;
  tokenType: string;
  expiresIn: string;
};

type MeResponse = {
  id: number;
  email: string;
  role: string;
  name: string | null;
};

type JsonResponse<T> = {
  ok: boolean;
  data?: T;
  message?: string;
};

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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/proxy${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await parseJsonResponse<T>(response);
  if (!response.ok || !json.ok || json.data === undefined) {
    throw new ApiError(json.message ?? "Request failed", response.status);
  }
  return json.data;
}

export async function login(payload: LoginPayload): Promise<{ token: string; email: string }> {
  const data = await requestJson<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  localStorage.setItem("kb3pl_user_email", payload.email);

  return { token: data.token, email: payload.email };
}

export async function getMe(): Promise<MeResponse> {
  return requestJson<MeResponse>("/auth/me");
}

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    cache: "no-store",
  });
  localStorage.removeItem("kb3pl_user_email");
}
