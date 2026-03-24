export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export type DataMode = "mock" | "mock-fallback" | "live" | "live-strict";

export function shouldUseMockMode() {
  return USE_MOCK;
}

export function shouldUseImplicitFallback(token?: string) {
  if (IS_PRODUCTION) return false;
  return token === "mock-token";
}

export function getDataMode(token?: string): DataMode {
  if (shouldUseMockMode()) return "mock";
  if (shouldUseImplicitFallback(token)) return "mock-fallback";
  if (IS_PRODUCTION) return "live-strict";
  return "live";
}

export function getDataModeLabel(token?: string) {
  const mode = getDataMode(token);
  if (mode === "mock") return "MOCK";
  if (mode === "mock-fallback") return "FALLBACK DEV";
  if (mode === "live-strict") return "LIVE";
  return "LIVE DEV";
}
