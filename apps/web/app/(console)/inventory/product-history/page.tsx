import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { AUTH_COOKIE_KEY } from "@/lib/auth";
import { getStockTransactions } from "@/features/inventory/api";
import { InventoryTransactionsTable } from "@/features/inventory/InventoryTransactionsTable";
import { listProducts } from "@/features/settings/products/api";
import { listClients } from "@/features/settings/clients/api";
import { listWarehouses } from "@/features/settings/warehouses/api";
import { ApiError } from "@/features/outbound/api";

const txnTypeOptions = [
  { label: "All", value: "" },
  { label: "Inbound", value: "inbound_receive" },
  { label: "Outbound", value: "outbound_ship" },
  { label: "Return Restock", value: "return_restock" },
  { label: "Return Dispose", value: "return_dispose" },
];

export default async function ProductHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    txn_type?: string;
    product_id?: string;
    client_id?: string;
    warehouse_id?: string;
    date_from?: string;
    date_to?: string;
    page?: string;
  }>;
}) {
  const { q, txn_type, product_id, client_id, warehouse_id, date_from, date_to, page } = await searchParams;
  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value;
  if (!token) redirect("/login?next=/inventory/product-history");
  const hasActiveFilter = Boolean(q?.trim() || txn_type || product_id || client_id || warehouse_id || date_from || date_to);
  const requestedPage = Number(page ?? "1");
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 100;

  let transactions: Awaited<ReturnType<typeof getStockTransactions>> = [];
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let warehouses: Awaited<ReturnType<typeof listWarehouses>> = [];
  let loadError: string | null = null;

  try {
    [transactions, products, clients, warehouses] = await Promise.all([
      hasActiveFilter ? getStockTransactions({ q, txn_type, product_id, client_id, warehouse_id, date_from, date_to, page: String(currentPage), limit: String(pageSize) }, { token }) : Promise.resolve([]),
      listProducts({ token }),
      listClients({ token }),
      listWarehouses({ token }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login?next=/inventory/product-history");
    }
    loadError = error instanceof Error ? error.message : "Unexpected product history error";
  }

  const selectedProduct = products.find((product) => String(product.id) === String(product_id ?? ""));
  const selectedClient = clients.find((client) => String(client.id) === String(client_id ?? ""));
  const selectedWarehouse = warehouses.find((warehouse) => String(warehouse.id) === String(warehouse_id ?? ""));
  const qtyIn = transactions.reduce((sum, row) => sum + Number(row.qty_in || 0), 0);
  const qtyOut = transactions.reduce((sum, row) => sum + Number(row.qty_out || 0), 0);
  const hasNextPage = transactions.length === pageSize;
  const buildPageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q?.trim()) params.set("q", q.trim());
    if (txn_type) params.set("txn_type", txn_type);
    if (product_id) params.set("product_id", product_id);
    if (client_id) params.set("client_id", client_id);
    if (warehouse_id) params.set("warehouse_id", warehouse_id);
    if (date_from) params.set("date_from", date_from);
    if (date_to) params.set("date_to", date_to);
    params.set("page", String(Math.max(1, nextPage)));
    return `/inventory/product-history?${params.toString()}`;
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Operations" }, { label: "Inventory" }]}
        title="Product In/Out History"
        subtitle="Product-level inbound, outbound, and return movement ledger"
      />

      <div className="mb-5 rounded-xl border bg-white px-4 py-3">
        <form className="grid gap-3 lg:grid-cols-[minmax(220px,1.3fr)_160px_150px_150px_minmax(220px,1fr)_auto]" action="/inventory/product-history">
          <input type="hidden" name="page" value="1" />
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Product</span>
            <select name="product_id" defaultValue={product_id ?? ""} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.barcode_full} | {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Client</span>
            <select name="client_id" defaultValue={client_id ?? ""} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.client_code} | {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Warehouse</span>
            <select name="warehouse_id" defaultValue={warehouse_id ?? ""} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
              <option value="">All Warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.warehouse_code} | {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Type</span>
            <select name="txn_type" defaultValue={txn_type ?? ""} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
              {txnTypeOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">From</span>
            <input name="date_from" type="date" defaultValue={date_from ?? ""} className="h-9 w-full rounded-md border bg-white px-3 text-sm" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">To</span>
            <input name="date_to" type="date" defaultValue={date_to ?? ""} className="h-9 w-full rounded-md border bg-white px-3 text-sm" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Search</span>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Client, product, barcode, lot, ref"
              className="h-9 w-full rounded-md border bg-white px-3 text-sm"
            />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="h-9 rounded-md border bg-slate-900 px-3 text-sm font-medium text-white">
              Apply
            </button>
            <Link href="/inventory/product-history" className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium text-slate-700">
              Reset
            </Link>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {selectedProduct ? <Badge variant="info">{selectedProduct.name}</Badge> : <Badge variant="default">All Products</Badge>}
          {selectedClient ? <Badge variant="info">{selectedClient.name}</Badge> : <Badge variant="default">All Clients</Badge>}
          {selectedWarehouse ? <Badge variant="info">{selectedWarehouse.name}</Badge> : <Badge variant="default">All Warehouses</Badge>}
          <Badge variant="success">{`Qty In: ${qtyIn.toLocaleString()}`}</Badge>
          <Badge variant="warning">{`Qty Out: ${qtyOut.toLocaleString()}`}</Badge>
          <Badge variant="default">{`Rows: ${transactions.length.toLocaleString()}`}</Badge>
          <Badge variant="default">{`Page: ${currentPage.toLocaleString()}`}</Badge>
        </div>
      </div>

      {loadError ? (
        <ErrorState title="Failed to load product history." message={loadError} />
      ) : !hasActiveFilter ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
          Select a product, client, warehouse, type, date range, or search term to load product movement history.
        </div>
      ) : (
        <>
          <InventoryTransactionsTable rows={transactions} />
          <div className="mt-4 flex items-center justify-end gap-2">
            {currentPage > 1 ? (
              <Link href={buildPageHref(currentPage - 1)} className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium text-slate-700">
                Previous
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium text-slate-400">Previous</span>
            )}
            {hasNextPage ? (
              <Link href={buildPageHref(currentPage + 1)} className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium text-slate-700">
                Next
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium text-slate-400">Next</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
