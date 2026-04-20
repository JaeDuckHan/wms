export const AUTH_COOKIE_KEY = "kb3pl_token";

function normalizeBase64Url(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  if (remainder === 0) return padded;
  return `${padded}${"=".repeat(4 - remainder)}`;
}

export function decodeJwtPayload<T>(token: string): T | null {
  const parts = String(token || "").split(".");
  if (parts.length < 2 || !parts[1]) return null;

  try {
    const json = Buffer.from(normalizeBase64Url(parts[1]), "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
