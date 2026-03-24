export type AppRole = "admin" | "manager" | "warehouse" | "client_viewer" | string;

export function canWrite(role?: AppRole | null) {
  return role === "admin" || role === "manager" || role === "warehouse";
}

export function isAdmin(role?: AppRole | null) {
  return role === "admin";
}

export function isClientViewer(role?: AppRole | null) {
  return role === "client_viewer";
}

export function canManageBillingSettings(role?: AppRole | null) {
  return isAdmin(role);
}

export function canAccessSettings(role?: AppRole | null) {
  return !isClientViewer(role);
}

export function canAccessBillingEvents(role?: AppRole | null) {
  return !isClientViewer(role);
}

export function canAccessInbounds(role?: AppRole | null) {
  return !isClientViewer(role);
}

export function getDefaultConsolePath(role?: AppRole | null) {
  if (isClientViewer(role)) {
    return "/billing";
  }
  return "/outbounds";
}
