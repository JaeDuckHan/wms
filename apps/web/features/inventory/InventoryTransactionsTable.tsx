"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/DataTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStockTransactions } from "@/features/inventory/api";
import type { StockTransactionRow } from "@/features/inventory/types";
import { listClients } from "@/features/settings/clients/api";
import type { Client } from "@/features/settings/clients/types";

type Props = {
  rows: StockTransactionRow[];
};

function formatQty(value: number) {
  return Number(value || 0).toLocaleString();
}

function findClient(clients: Client[], row: StockTransactionRow) {
  return clients.find((client) => client.id === row.client_id || client.client_code === row.client_code) ?? null;
}

export function InventoryTransactionsTable({ rows }: Props) {
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [clientRow, setClientRow] = useState<StockTransactionRow | null>(null);
  const [clientDetail, setClientDetail] = useState<Client | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const clientCache = useRef<Client[] | null>(null);

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productRow, setProductRow] = useState<StockTransactionRow | null>(null);
  const [productHistoryRows, setProductHistoryRows] = useState<StockTransactionRow[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const productHistoryCache = useRef<Map<string, StockTransactionRow[]>>(new Map());

  const fallbackProductRows = useMemo(
    () => (productRow ? rows.filter((row) => row.product_id === productRow.product_id) : []),
    [productRow, rows]
  );
  const displayedProductRows = productHistoryRows.length > 0 ? productHistoryRows : fallbackProductRows;
  const productQtyIn = displayedProductRows.reduce((sum, row) => sum + Number(row.qty_in || 0), 0);
  const productQtyOut = displayedProductRows.reduce((sum, row) => sum + Number(row.qty_out || 0), 0);

  async function openClientLayer(row: StockTransactionRow) {
    setClientRow(row);
    setClientDetail(null);
    setClientError(null);
    setClientDialogOpen(true);

    if (clientCache.current) {
      setClientDetail(findClient(clientCache.current, row));
      setClientLoading(false);
      return;
    }

    setClientLoading(true);

    try {
      const clients = await listClients();
      clientCache.current = clients;
      setClientDetail(findClient(clients, row));
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Failed to load client details.");
    } finally {
      setClientLoading(false);
    }
  }

  async function openProductHistoryLayer(row: StockTransactionRow) {
    setProductRow(row);
    setProductHistoryRows(rows.filter((item) => item.product_id === row.product_id));
    setProductError(null);
    setProductDialogOpen(true);

    const cacheKey = String(row.product_id);
    const cachedRows = productHistoryCache.current.get(cacheKey);
    if (cachedRows) {
      setProductHistoryRows(cachedRows);
      setProductLoading(false);
      return;
    }

    setProductLoading(true);

    try {
      const historyRows = await getStockTransactions({ product_id: row.product_id });
      productHistoryCache.current.set(cacheKey, historyRows);
      setProductHistoryRows(historyRows);
    } catch (error) {
      setProductError(error instanceof Error ? error.message : "Failed to load product history.");
    } finally {
      setProductLoading(false);
    }
  }

  return (
    <>
      <DataTable
        rows={rows}
        emptyText="No stock transactions found."
        columns={[
          { key: "txn_date", label: "Txn Date", className: "tabular-nums", render: (row) => row.txn_date },
          { key: "txn_type", label: "Type", render: (row) => row.txn_type },
          {
            key: "client",
            label: "Client",
            render: (row) => (
              <button
                type="button"
                className="text-left font-medium text-slate-900 hover:underline"
                onClick={() => void openClientLayer(row)}
              >
                {row.client}
              </button>
            ),
          },
          {
            key: "product",
            label: "Product",
            render: (row) => (
              <button
                type="button"
                className="text-left font-medium text-slate-900 hover:underline"
                onClick={() => void openProductHistoryLayer(row)}
              >
                {row.product}
              </button>
            ),
          },
          { key: "lot", label: "Lot", render: (row) => row.lot },
          { key: "qty_in", label: "Qty In", className: "tabular-nums", render: (row) => row.qty_in },
          { key: "qty_out", label: "Qty Out", className: "tabular-nums", render: (row) => row.qty_out },
          { key: "current_stock_qty", label: "Current Balance Now", className: "tabular-nums", render: (row) => row.current_stock_qty },
          {
            key: "ref",
            label: "Ref",
            render: (row) =>
              row.source_path ? <Link href={row.source_path} className="font-medium text-slate-900 hover:underline">{row.source_no || row.ref}</Link> : row.source_no || row.ref,
          },
        ]}
      />

      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client Info</DialogTitle>
            <DialogDescription>Selected client information from this inventory transaction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Client Code</p>
                <p className="mt-1 font-medium">{clientDetail?.client_code ?? clientRow?.client_code ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Client Name</p>
                <p className="mt-1 font-medium">{clientDetail?.name ?? clientRow?.client ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Status</p>
                <p className="mt-1">
                  {clientDetail ? <Badge variant={clientDetail.status === "active" ? "success" : "warning"}>{clientDetail.status}</Badge> : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Last Transaction</p>
                <p className="mt-1 tabular-nums">{clientRow?.txn_date ?? "-"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Memo</p>
              <p className="mt-1 rounded-md border bg-slate-50 px-3 py-2 text-slate-700">{clientDetail?.memo || "-"}</p>
            </div>
            {clientLoading ? <p className="text-xs text-slate-500">Loading client details...</p> : null}
            {clientError ? <p className="text-xs text-amber-700">{clientError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setClientDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product In/Out History</DialogTitle>
            <DialogDescription>{productRow?.product ?? "Selected product transaction history."}</DialogDescription>
          </DialogHeader>
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <Badge variant="default">{`Rows: ${displayedProductRows.length}`}</Badge>
            <Badge variant="success">{`Qty In: ${formatQty(productQtyIn)}`}</Badge>
            <Badge variant="warning">{`Qty Out: ${formatQty(productQtyOut)}`}</Badge>
          </div>
          {productLoading ? <p className="mb-3 text-xs text-slate-500">Loading full product history...</p> : null}
          {productError ? <p className="mb-3 text-xs text-amber-700">{productError}</p> : null}
          <DataTable
            rows={displayedProductRows}
            emptyText="No product history found."
            columns={[
              { key: "txn_date", label: "Txn Date", className: "tabular-nums", render: (row) => row.txn_date },
              { key: "txn_type", label: "Type", render: (row) => row.txn_type },
              { key: "client", label: "Client", render: (row) => row.client },
              { key: "lot", label: "Lot", render: (row) => row.lot },
              { key: "warehouse", label: "Warehouse", render: (row) => row.warehouse },
              { key: "location", label: "Location", render: (row) => row.location },
              { key: "qty_in", label: "Qty In", className: "tabular-nums", render: (row) => row.qty_in },
              { key: "qty_out", label: "Qty Out", className: "tabular-nums", render: (row) => row.qty_out },
              { key: "current_stock_qty", label: "Current Balance Now", className: "tabular-nums", render: (row) => row.current_stock_qty },
              {
                key: "ref",
                label: "Ref",
                render: (row) =>
                  row.source_path ? <Link href={row.source_path} className="font-medium text-slate-900 hover:underline">{row.source_no || row.ref}</Link> : row.source_no || row.ref,
              },
            ]}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setProductDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
