import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { TranslatedText } from "@/components/i18n/TranslatedText";
import { AUTH_COOKIE_KEY } from "@/lib/auth";
import { getStockBalances, getStockTransactions } from "@/features/inventory/api";
import { InventoryTransactionsTable } from "@/features/inventory/InventoryTransactionsTable";
import type { InventoryTab } from "@/features/inventory/types";
import { ApiError } from "@/features/outbound/api";
import { listProducts } from "@/features/settings/products/api";

const tabs: Array<{ label: string; value: InventoryTab }> = [
  { label: "Balances", value: "balances" },
  { label: "Transactions", value: "transactions" },
];

const txnTypeFilter = [
  { label: "All Types", value: "" },
  { label: "Inbound Receive", value: "inbound_receive" },
  { label: "Outbound Ship", value: "outbound_ship" },
  { label: "Return Restock", value: "return_restock" },
  { label: "Return Dispose", value: "return_dispose" },
];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: InventoryTab; txn_type?: string; product_id?: string }>;
}) {
  const { q, tab, txn_type, product_id } = await searchParams;
  const currentTab = tabs.some((item) => item.value === tab) ? tab : "balances";
  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value;
  if (!token) redirect("/login?next=/inventory");

  let balances = [] as Awaited<ReturnType<typeof getStockBalances>>;
  let transactions = [] as Awaited<ReturnType<typeof getStockTransactions>>;
  let products = [] as Awaited<ReturnType<typeof listProducts>>;
  let loadError: string | null = null;

  try {
    if (currentTab === "balances") {
      balances = await getStockBalances({ q }, { token });
    } else {
      [transactions, products] = await Promise.all([
        getStockTransactions({ q, txn_type, product_id }, { token }),
        listProducts({ token }),
      ]);
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login?next=/inventory");
    }
    loadError = error instanceof Error ? error.message : "Unexpected inventory error";
  }

  const productHistoryParams = (selectedProductId: string) => {
    const params = new URLSearchParams();
    params.set("product_id", selectedProductId);
    return params;
  };

  const table = loadError ? (
    <ErrorState title="Failed to load inventory data." message={loadError} />
  ) :
    currentTab === "balances" ? (
      <DataTable
        rows={balances}
        emptyText="No stock balances found."
        columns={[
          { key: "client", label: "Client", render: (row) => (
            <Link href={`/settings/clients?q=${encodeURIComponent(row.client_code || row.client)}`} className="font-medium text-slate-900 hover:underline">
              {row.client}
            </Link>
          ) },
          { key: "product", label: "Product", render: (row) => (
            <Link href={`/inventory/product-history?${productHistoryParams(row.product_id).toString()}`} className="font-medium text-slate-900 hover:underline">
              {row.product}
            </Link>
          ) },
          { key: "lot", label: "Lot", render: (row) => row.lot },
          { key: "warehouse", label: "Warehouse", render: (row) => row.warehouse },
          { key: "location", label: "Location", render: (row) => row.location },
          { key: "available_qty", label: "Available Qty", className: "tabular-nums", render: (row) => row.available_qty },
          { key: "reserved_qty", label: "Reserved Qty", className: "tabular-nums", render: (row) => row.reserved_qty },
          { key: "allocatable_qty", label: "Allocatable Qty", className: "tabular-nums", render: (row) => row.allocatable_qty },
          {
            key: "reservation_pressure",
            label: "Reservation Pressure",
            render: (row) => (
              <Badge
                variant={
                  row.reservation_status === "full"
                    ? "danger"
                    : row.reservation_status === "high"
                      ? "warning"
                      : row.reservation_status === "medium"
                        ? "info"
                        : "default"
                }
              >
                {`${row.reservation_rate_pct}%`}
              </Badge>
            ),
          },
        ]}
      />
    ) : (
      <InventoryTransactionsTable rows={transactions} />
    );

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Operations" }, { label: "Inventory" }]}
        title="Inventory"
        subtitle="Live stock balances, reserved stock, and allocatable stock"
      />

      <div className="mb-5 rounded-xl border bg-white px-4 py-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <TranslatedText text="View" />
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((item) => {
            const params = new URLSearchParams();
            params.set("tab", item.value);
            if (q) params.set("q", q);
            if (txn_type) params.set("txn_type", txn_type);
            if (product_id) params.set("product_id", product_id);
            const active = currentTab === item.value;
            return (
              <Link key={item.value} href={`/inventory?${params.toString()}`}>
                <Badge variant={active ? "info" : "default"}>
                  <TranslatedText text={item.label} />
                </Badge>
              </Link>
            );
          })}
        </div>
        {currentTab === "balances" && (
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <p>Allocatable Qty = Available Qty - Reserved Qty</p>
            <p>Reservation Pressure = Reserved Qty / Available Qty</p>
          </div>
        )}

        {currentTab === "transactions" && (
          <>
            <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              <TranslatedText text="Transaction Type" />
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {txnTypeFilter.map((item) => {
                const params = new URLSearchParams();
                params.set("tab", "transactions");
                if (q) params.set("q", q);
                if (product_id) params.set("product_id", product_id);
                if (item.value) params.set("txn_type", item.value);
                const active = (txn_type ?? "") === item.value;
                return (
                  <Link key={item.label} href={`/inventory?${params.toString()}`}>
                    <Badge variant={active ? "info" : "default"}>
                      <TranslatedText text={item.label} />
                    </Badge>
                  </Link>
                );
              })}
            </div>
            <form className="mt-4 flex flex-wrap items-end gap-2" action="/inventory">
              <input type="hidden" name="tab" value="transactions" />
              {txn_type ? <input type="hidden" name="txn_type" value={txn_type} /> : null}
              <label className="min-w-72 flex-1">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Search client or product
                </span>
                <input
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="Client, product, barcode, lot, ref"
                  className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                />
              </label>
              <label className="min-w-72">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  <TranslatedText text="Product" />
                </span>
                <select name="product_id" defaultValue={product_id ?? ""} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                  <option value="">All Products</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.barcode_full} | {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="h-9 rounded-md border bg-slate-900 px-3 text-sm font-medium text-white">
                <TranslatedText text="Apply" />
              </button>
            </form>
          </>
        )}
      </div>

      {table}
    </section>
  );
}
