type ApiErrorDetail = {
  path?: string | Array<string | number>;
  message?: string;
};

type ApiErrorPayload = {
  code?: string;
  message?: string;
  details?: ApiErrorDetail[] | unknown;
};

function formatPath(path: ApiErrorDetail["path"]) {
  if (Array.isArray(path)) return path.map((part) => String(part)).filter(Boolean).join(".");
  return String(path ?? "").trim();
}

function formatDetail(detail: ApiErrorDetail) {
  const path = formatPath(detail.path);
  const message = String(detail.message ?? "").trim();
  if (path && message) return `${path}: ${message}`;
  return path || message;
}

export function formatApiErrorMessage(payload: ApiErrorPayload | null | undefined, fallback = "Request failed") {
  const baseMessage = String(payload?.message || fallback).trim() || fallback;
  const details = Array.isArray(payload?.details)
    ? payload.details
        .map((detail) => formatDetail(detail as ApiErrorDetail))
        .filter(Boolean)
    : [];

  if (details.length === 0) return baseMessage;
  if (details.every((detail) => baseMessage.includes(detail))) return baseMessage;
  return `${baseMessage}: ${details.join("; ")}`;
}
