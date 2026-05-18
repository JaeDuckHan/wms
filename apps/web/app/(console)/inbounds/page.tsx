import Link from "next/link";
import { cookies } from "next/headers";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TranslatedText } from "@/components/i18n/TranslatedText";
import { AUTH_COOKIE_KEY, decodeJwtPayload } from "@/lib/auth";
import { canWrite } from "@/lib/authz";
import { getInboundOrders } from "@/features/inbound/api";
import type { InboundListStatus, InboundOrder, InboundStatus } from "@/features/inbound/types";

const filterItems: Array<{ label: string; value: InboundListStatus }> = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Submitted", value: "submitted" },
  { label: "Arrived", value: "arrived" },
  { label: "Received", value: "received" },
];

function statusBadge(status: InboundStatus) {
  const map: Record<InboundStatus, { label: string; variant: "default" | "info" | "warning" | "success" }> = {
    draft: { label: "Draft", variant: "default" },
    submitted: { label: "Submitted", variant: "info" },
    arrived: { label: "Arrived", variant: "warning" },
    qc_hold: { label: "QC Hold", variant: "warning" },
    received: { label: "Received", variant: "success" },
    cancelled: { label: "Cancelled", variant: "default" },
  };
  const current = map[status];
  return (
    <Badge variant={current.variant}>
      <TranslatedText text={current.label} />
    </Badge>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function InboundItemsPreview({ order }: { order: InboundOrder }) {
  const firstItem = order.items[0];

  if (!firstItem) {
    return <span className="text-slate-600">{order.summary}</span>;
  }

  const extraCount = Math.max(0, order.items.length - 1);
  const totalAmount =
    firstItem.invoice_price === null ? null : firstItem.invoice_price * firstItem.qty;

  return (
    <div className="min-w-[420px] space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-slate-900">{firstItem.barcode_full}</span>
        <span className="text-slate-700">{firstItem.product_name}</span>
        {extraCount > 0 ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            +{extraCount} <TranslatedText text="More Items" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          <TranslatedText text="Lot No" />: {firstItem.lot}
        </span>
        <span>
          <TranslatedText text="Expiry Date" />: {firstItem.expiry_date ?? "-"}
        </span>
        <span>
          <TranslatedText text="Qty" />: {formatNumber(firstItem.qty)}
        </span>
        <span>
          <TranslatedText text="Currency" />: {firstItem.currency ?? "-"}
        </span>
        <span>
          <TranslatedText text="Total Amount" />: {totalAmount === null ? "-" : formatNumber(totalAmount)}
        </span>
      </div>
    </div>
  );
}

export default async function InboundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: InboundListStatus }>;
}) {
  const { q, status } = await searchParams;
  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value;
  const payload = decodeJwtPayload<{ role?: string }>(token ?? "");
  const canCreate = canWrite(payload?.role);
  const currentStatus = filterItems.some((item) => item.value === status) ? status : "all";
  const orders = await getInboundOrders({ q, status: currentStatus }, { token });

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Operations" }, { label: "Inbounds" }]}
        title="Inbounds"
        subtitle="Inbound order queue overview"
        rightSlot={
          canCreate ? (
            <Link href="/inbounds/new">
              <Button>
                <Plus className="h-4 w-4" />
                New
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filterItems.map((item) => {
          const active = currentStatus === item.value;
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (item.value !== "all") params.set("status", item.value);
          return (
            <Link key={item.value} href={`/inbounds?${params.toString()}`}>
              <Badge variant={active ? "info" : "default"}>
                <TranslatedText text={item.label} />
              </Badge>
            </Link>
          );
        })}
      </div>

      <DataTable
        rows={orders}
        emptyText="No inbound orders found."
        columns={[
          {
            key: "inbound_no",
            label: "Inbound No",
            render: (row) => (
              <Link href={`/inbounds/${encodeURIComponent(row.inbound_no)}`} className="font-medium text-slate-900 hover:underline">
                {row.inbound_no}
              </Link>
            ),
          },
          { key: "client", label: "Client", render: (row) => row.client },
          { key: "inbound_date", label: "Date", render: (row) => <span className="tabular-nums">{row.inbound_date}</span> },
          { key: "items", label: "Items", render: (row) => <InboundItemsPreview order={row} /> },
          { key: "status", label: "Status", render: (row) => statusBadge(row.status) },
        ]}
      />
    </section>
  );
}
