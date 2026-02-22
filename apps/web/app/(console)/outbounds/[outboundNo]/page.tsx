import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TranslatedText } from "@/components/i18n/TranslatedText";
import { getOutboundOrderByNo } from "@/features/outbound/api";
import { OutboundDetailView } from "@/features/outbound/OutboundDetailView";
import { AUTH_COOKIE_KEY } from "@/lib/auth";

export default async function OutboundDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ outboundNo: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { outboundNo } = await params;
  const routeNo = decodeURIComponent(outboundNo);
  const { tab } = await searchParams;
  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value;
  const order = await getOutboundOrderByNo(routeNo, { token });

  if (!order) {
    return (
      <section className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900"><TranslatedText text="Not found" /></h2>
        <p className="mt-1 text-sm text-slate-500">
          <TranslatedText text="Outbound" /> `{routeNo}` <TranslatedText text="was not found." />
        </p>
        <div className="mt-4">
          <Link href="/outbounds">
            <Button variant="secondary" size="sm"><TranslatedText text="Back to list" /></Button>
          </Link>
        </div>
      </section>
    );
  }

  return <OutboundDetailView order={order} initialTab={tab} />;
}
