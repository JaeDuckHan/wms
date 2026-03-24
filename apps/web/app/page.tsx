import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_KEY } from "@/lib/auth";
import { getDefaultConsolePath } from "@/lib/authz";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3100";

export default async function Home() {
  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      redirect("/login");
    }

    const json = (await response.json()) as { ok?: boolean; data?: { role?: string } };
    if (!json.ok) {
      redirect("/login");
    }

    redirect(getDefaultConsolePath(json.data?.role ?? null));
  } catch {
    redirect("/login");
  }
}
