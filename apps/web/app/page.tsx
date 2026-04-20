import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_KEY, decodeJwtPayload } from "@/lib/auth";
import { getDefaultConsolePath } from "@/lib/authz";

export default async function Home() {
  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value;

  if (!token) {
    redirect("/login");
  }

  const payload = decodeJwtPayload<{ role?: string; exp?: number }>(token);
  if (!payload?.role) {
    redirect("/login");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= nowSeconds) {
    redirect("/login");
  }

  redirect(getDefaultConsolePath(payload.role));
}
