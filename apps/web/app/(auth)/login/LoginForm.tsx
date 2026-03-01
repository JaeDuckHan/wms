"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { login } from "@/features/auth/api";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/features/outbound/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

type LoginCandidate = {
  email: string;
  password: string;
};

const FALLBACK_CREDENTIALS: LoginCandidate[] = [
  { email: "admin.demo@example.com", password: "1234" },
  { email: "admin@example.com", password: "x" },
  { email: "manager101@example.com", password: "x" },
];

export function LoginForm({ nextUrl }: { nextUrl: string }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const { t } = useI18n();

  const [email, setEmail] = useState("admin.demo@example.com");
  const [password, setPassword] = useState("1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildLoginCandidates = (): LoginCandidate[] => {
    const first: LoginCandidate = { email: email.trim(), password };
    const dedup = new Set<string>();
    const ordered = [first, ...FALLBACK_CREDENTIALS];
    const list: LoginCandidate[] = [];

    for (const candidate of ordered) {
      if (!candidate.email || !candidate.password) continue;
      const key = `${candidate.email}::${candidate.password}`;
      if (dedup.has(key)) continue;
      dedup.add(key);
      list.push(candidate);
    }
    return list;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError(t("Email and password are required."));
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const candidates = buildLoginCandidates();
      let loggedIn = false;
      let lastError: unknown = null;

      for (const candidate of candidates) {
        try {
          await login(candidate);
          setEmail(candidate.email);
          setPassword(candidate.password);
          loggedIn = true;
          break;
        } catch (candidateError) {
          lastError = candidateError;
        }
      }

      if (!loggedIn) {
        throw lastError ?? new Error("Login request failed");
      }

      pushToast({ title: t("Login successful"), variant: "success" });
      router.replace(nextUrl);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t("Login request failed");
      setError(message);
      pushToast({ title: t("Login failed"), description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Kowinsblue 3PL Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("Signing in...") : t("Sign in")}
            </Button>
          </form>
          <p className="text-xs text-slate-500">{t("Use a valid WMS API account.")}</p>
        </CardContent>
      </Card>
    </div>
  );
}


