import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getOutboundOrderById } from "@/features/outbound/api";
import { OutboundDetailView } from "@/features/outbound/OutboundDetailView";
import { AUTH_COOKIE_KEY } from "@/lib/auth";

export default async function OutboundDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value;
  const order = await getOutboundOrderById(id, { token });

  if (!order) {
    notFound();
  }

  return <OutboundDetailView order={order} initialTab={tab} />;
}
