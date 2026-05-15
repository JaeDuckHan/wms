"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import type { InboundAction, InboundItem, InboundOrder, InboundStatus } from "@/features/inbound/types";
import { ApiError } from "@/features/outbound/api";
import { cancelInboundOrder, deleteInboundItem, transitionInboundStatus, updateInboundItem, updateInboundOrderDetails } from "@/features/inbound/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
const tabs = ["overview", "items", "timeline"] as const;
type TabValue = (typeof tabs)[number];

function normalizeTab(tab?: string): TabValue {
  if (tab && tabs.includes(tab as TabValue)) return tab as TabValue;
  return "overview";
}

function actionByStatus(status: InboundOrder["status"]): InboundAction | null {
  if (status === "draft") return "submit";
  if (status === "submitted") return "arrive";
  if (status === "arrived" || status === "qc_hold") return "receive";
  return null;
}

function actionLabel(action: InboundAction) {
  if (action === "submit") return "Submit";
  if (action === "arrive") return "Arrive";
  return "Receive";
}

function statusBadge(status: InboundStatus, t: (text: string) => string) {
  const map: Record<InboundStatus, { label: string; variant: "default" | "info" | "warning" | "success" }> = {
    draft: { label: "Draft", variant: "default" },
    submitted: { label: "Submitted", variant: "info" },
    arrived: { label: "Arrived", variant: "warning" },
    qc_hold: { label: "QC Hold", variant: "warning" },
    received: { label: "Received", variant: "success" },
    cancelled: { label: "Cancelled", variant: "default" },
  };
  const current = map[status];
  return <Badge variant={current.variant}>{t(current.label)}</Badge>;
}

export function InboundDetailView({ order: initialOrder, initialTab }: { order: InboundOrder; initialTab?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const { t } = useI18n();
  const { canWrite, ready } = useCurrentUser();

  const [order, setOrder] = useState(initialOrder);
  const [tab, setTab] = useState<TabValue>(normalizeTab(initialTab));
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editDate, setEditDate] = useState(initialOrder.inbound_date);
  const [editMemo, setEditMemo] = useState(initialOrder.memo === "-" ? "" : initialOrder.memo);
  const [editingItem, setEditingItem] = useState<InboundItem | null>(null);
  const [itemQty, setItemQty] = useState("");
  const [itemInvoicePrice, setItemInvoicePrice] = useState("");
  const [itemRemark, setItemRemark] = useState("");
  const [itemError, setItemError] = useState<string | null>(null);
  const currentAction = actionByStatus(order.status);
  const canMutate = ready && canWrite && order.status !== "cancelled";

  const setTabWithQuery = (nextTab: string) => {
    const normalized = normalizeTab(nextTab);
    setTab(normalized);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", normalized);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const runStatusAction = async () => {
    if (!currentAction) return;
    setLoading(true);
    try {
      const updated = await transitionInboundStatus(order.inbound_no, currentAction);
      setOrder(updated);
      pushToast({
        title: `${t(actionLabel(currentAction))} ${t("completed")}`,
        description: `${t("Inbound status changed to")} ${t(updated.status)}.`,
        variant: "success",
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("Action failed");
      pushToast({ title: t("Action failed"), description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = () => {
    setEditDate(order.inbound_date);
    setEditMemo(order.memo === "-" ? "" : order.memo);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setLoading(true);
    try {
      const updated = await updateInboundOrderDetails(order.inbound_no, {
        inbound_date: editDate,
        memo: editMemo.trim() || null,
      });
      setOrder(updated);
      setEditOpen(false);
      pushToast({ title: "Inbound updated", variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Update failed";
      pushToast({ title: "Update failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const runCancel = async () => {
    setLoading(true);
    try {
      const updated = await cancelInboundOrder(order.inbound_no);
      setOrder(updated);
      setCancelOpen(false);
      pushToast({ title: "Inbound cancelled", variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Cancel failed";
      pushToast({ title: "Cancel failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const openItemEdit = (item: InboundItem) => {
    setEditingItem(item);
    setItemQty(String(item.qty));
    setItemInvoicePrice(item.invoice_price == null ? "" : String(item.invoice_price));
    setItemRemark(item.remark ?? "");
    setItemError(null);
  };

  const saveItemEdit = async () => {
    if (!editingItem) return;
    const qty = Number(itemQty);
    const invoicePrice = itemInvoicePrice.trim() ? Number(itemInvoicePrice) : null;
    if (!Number.isInteger(qty) || qty <= 0) {
      setItemError("Qty must be a positive integer.");
      return;
    }
    if (invoicePrice !== null && (!Number.isFinite(invoicePrice) || invoicePrice <= 0)) {
      setItemError("Invoice price must be a positive number.");
      return;
    }
    if (!editingItem.product_id || !editingItem.lot_id) {
      setItemError("This item is missing product or LOT metadata. Reload the page and try again.");
      return;
    }

    setLoading(true);
    try {
      const updated = await updateInboundItem(order.inbound_no, editingItem.id, {
        product_id: editingItem.product_id,
        lot_id: editingItem.lot_id,
        location_id: editingItem.location_id ?? null,
        qty,
        invoice_price: invoicePrice,
        currency: invoicePrice === null ? null : "USD",
        remark: itemRemark.trim() || null,
      });
      setOrder(updated);
      setEditingItem(null);
      pushToast({ title: "Inbound item updated", variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Item update failed";
      setItemError(message);
      pushToast({ title: "Item update failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const removeInboundItem = async (item: InboundItem) => {
    if (!window.confirm(`Delete item ${item.product_name}?`)) return;
    setLoading(true);
    try {
      const updated = await deleteInboundItem(order.inbound_no, item.id);
      setOrder(updated);
      pushToast({ title: "Inbound item deleted", variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Item delete failed";
      pushToast({ title: "Item delete failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const itemColumns = useMemo(
    () => [
      { key: "barcode_full", label: "barcode_full", render: (row: InboundOrder["items"][number]) => row.barcode_full },
      { key: "product_name", label: "product_name", render: (row: InboundOrder["items"][number]) => row.product_name },
      { key: "lot", label: "lot", render: (row: InboundOrder["items"][number]) => row.lot },
      { key: "location", label: "location", render: (row: InboundOrder["items"][number]) => row.location },
      { key: "qty", label: "qty", className: "tabular-nums", render: (row: InboundOrder["items"][number]) => row.qty },
      {
        key: "invoice_price",
        label: "invoice_price",
        className: "tabular-nums",
        render: (row: InboundOrder["items"][number]) => (row.invoice_price === null ? "-" : row.invoice_price),
      },
      { key: "currency", label: "currency", render: (row: InboundOrder["items"][number]) => row.currency ?? "-" },
      {
        key: "actions",
        label: "Actions",
        render: (row: InboundOrder["items"][number]) =>
          canMutate ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => openItemEdit(row)} disabled={loading}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => void removeInboundItem(row)} disabled={loading}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          ) : null,
      },
    ],
    [canMutate, loading]
  );

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Operations" }, { label: "Inbounds", href: "/inbounds" }, { label: order.inbound_no }]}
        title={order.inbound_no}
        subtitle={`${order.client} | ${t("Date")} ${order.inbound_date}`}
        rightSlot={
          <div className="flex items-center gap-2">
            {statusBadge(order.status, t)}
            {canMutate && (
              <Button variant="secondary" onClick={openEdit} disabled={loading}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            {canMutate && (
              <Button variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => setCancelOpen(true)} disabled={loading}>
                <Ban className="h-4 w-4" />
                Cancel
              </Button>
            )}
            {canMutate && currentAction && (
              <Button onClick={runStatusAction} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t(actionLabel(currentAction))}
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTabWithQuery}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">{t("Overview")}</TabsTrigger>
          <TabsTrigger value="items">{t("Items")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("Timeline")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>{t("Client")}</CardTitle></CardHeader>
            <CardContent><p className="text-sm font-medium">{order.client}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("Warehouse")}</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{order.warehouse}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("Summary")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">{t(order.summary)}</p>
              <p className="text-sm text-slate-500">{t(order.memo)}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <DataTable rows={order.items} columns={itemColumns} emptyText={t("No inbound items.")} />
        </TabsContent>

        <TabsContent value="timeline">
          {order.timeline.length === 0 ? (
            <div className="rounded-xl border bg-white px-6 py-8 text-center text-sm text-slate-500">{t("No timeline logs.")}</div>
          ) : (
            <div className="rounded-xl border bg-white px-6 py-2">
              {order.timeline.map((log, idx) => (
                <div key={log.id} className="relative flex gap-4 py-4">
                  <div className="flex w-5 flex-col items-center">
                    <span className="mt-1 h-2 w-2 rounded-full bg-slate-500" />
                    {idx < order.timeline.length - 1 && <span className="mt-1 h-full w-px bg-slate-200" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t(log.title)}</p>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                      {log.at} | {log.actor}
                    </p>
                    {log.note && <p className="mt-1 text-sm text-slate-600">{t(log.note)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inbound Edit</DialogTitle>
            <DialogDescription>
              Adjust basic inbound details. Use the process buttons or Cancel action for status changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-600">
              Date
              <Input className="mt-1" type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Memo
              <Input className="mt-1" value={editMemo} onChange={(event) => setEditMemo(event.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={loading || !editDate}>{loading ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Inbound</DialogTitle>
            <DialogDescription>
              This changes the inbound status to cancelled. If receipt was already applied, related stock and billing effects are rolled back by the API.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={loading}>Keep Order</Button>
            <Button className="bg-rose-700 hover:bg-rose-800" onClick={() => void runCancel()} disabled={loading}>
              {loading ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inbound Item</DialogTitle>
            <DialogDescription>
              Adjust item quantity, invoice price, or remark. Product, LOT, and location stay fixed for stock traceability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-600">
              Qty
              <Input className="mt-1" type="number" min={1} value={itemQty} onChange={(event) => setItemQty(event.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Invoice Price (USD)
              <Input
                className="mt-1"
                type="number"
                min={0}
                step="0.0001"
                value={itemInvoicePrice}
                onChange={(event) => setItemInvoicePrice(event.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Remark
              <Input className="mt-1" value={itemRemark} onChange={(event) => setItemRemark(event.target.value)} />
            </label>
            {itemError ? <p className="text-sm text-rose-700">{itemError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingItem(null)} disabled={loading}>Cancel</Button>
            <Button onClick={() => void saveItemEdit()} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}


