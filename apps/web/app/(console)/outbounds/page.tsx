import Link from "next/link";
import { cookies } from "next/headers";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getOutboundOrders } from "@/features/outbound/api";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TranslatedText } from "@/components/i18n/TranslatedText";
import type { OutboundListStatus, OutboundOrder } from "@/features/outbound/types";
import { AUTH_COOKIE_KEY, decodeJwtPayload } from "@/lib/auth";
import { canWrite } from "@/lib/authz";

const filterItems: Array<{ label: string; value: OutboundListStatus }> = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Allocated", value: "allocated" },
  { label: "Picking", value: "picking" },
  { label: "Packed", value: "packed" },
  { label: "Shipped", value: "shipped" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function OutboundItemsPreview({ order }: { order: OutboundOrder }) {
  const firstItem = order.items[0];

  if (!firstItem) {
    return <span className="text-slate-600">{order.summary}</span>;
  }

  const extraCount = Math.max(0, order.items.length - 1);

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
          <TranslatedText text="Qty" />: {formatNumber(firstItem.requested_qty)}
        </span>
        <span>
          <TranslatedText text="Packed Box" />: {firstItem.box_type ?? "-"}
        </span>
        <span>
          <TranslatedText text="Tracking No" />: {order.tracking_no || "-"}
        </span>
      </div>
    </div>
  );
}

export default async function OutboundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: OutboundListStatus }>;
}) {
  const { q, status } = await searchParams;
  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value;
  const payload = decodeJwtPayload<{ role?: string }>(token ?? "");
  const canCreate = canWrite(payload?.role);
  const currentStatus = filterItems.some((item) => item.value === status) ? status : "all";
  const orders = await getOutboundOrders({ q, status: currentStatus }, { token });

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Operations" }, { label: "Outbounds" }]}
        title="Outbounds"
        subtitle="Outbound order queue overview"
        rightSlot={
          canCreate ? (
            <Link href="/outbounds/new">
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
            <Link key={item.value} href={`/outbounds?${params.toString()}`}>
              <Badge variant={active ? "info" : "default"}>
                <TranslatedText text={item.label} />
              </Badge>
            </Link>
          );
        })}
      </div>

      <DataTable
        rows={orders}
        emptyText="No outbound orders found."
        columns={[
          {
            key: "outbound_no",
            label: "Outbound No",
            render: (row) => (
              <Link href={`/outbounds/${encodeURIComponent(row.outbound_no)}`} className="font-medium text-slate-900 hover:underline">
                {row.outbound_no}
              </Link>
            ),
          },
          { key: "client", label: "Client", render: (row) => row.client },
          { key: "eta_date", label: "ETA", render: (row) => <span className="tabular-nums">{row.eta_date}</span> },
          { key: "items", label: "Items", render: (row) => <OutboundItemsPreview order={row} /> },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
        ]}
      />
    </section>
  );
}
