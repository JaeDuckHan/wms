import { ClientsSettingsPage } from "@/features/settings/clients/ClientsSettingsPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <ClientsSettingsPage initialSearch={q ?? ""} />;
}
