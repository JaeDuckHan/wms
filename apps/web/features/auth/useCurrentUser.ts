"use client";

import { useEffect, useState } from "react";
import { getMe } from "@/features/auth/api";
import {
  canAccessBillingEvents,
  canAccessInbounds,
  canAccessSettings,
  canManageBillingSettings,
  canWrite,
  isAdmin,
  isClientViewer,
  type AppRole,
} from "@/lib/authz";

type CurrentUser = {
  id: number;
  email: string;
  role: AppRole;
  name: string | null;
};

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        setUser({
          id: me.id,
          email: me.email,
          role: me.role,
          name: me.name,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
      })
      .finally(() => {
        if (cancelled) return;
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const role = user?.role ?? null;
  return {
    user,
    role,
    ready,
    canWrite: canWrite(role),
    isAdmin: isAdmin(role),
    isClientViewer: isClientViewer(role),
    canAccessSettings: canAccessSettings(role),
    canAccessBillingEvents: canAccessBillingEvents(role),
    canAccessInbounds: canAccessInbounds(role),
    canManageBillingSettings: canManageBillingSettings(role),
  };
}
