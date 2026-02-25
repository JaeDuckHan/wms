"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import type { OutboundAction, OutboundOrder } from "@/features/outbound/types";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addOutboundBox, ApiError, transitionOutboundStatus } from "@/features/outbound/api";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
const tabs = ["overview", "items", "boxes", "timeline"] as const;
type TabValue = (typeof tabs)[number];

function normalizeTab(tab?: string): TabValue {
  if (tab && tabs.includes(tab as TabValue)) return tab as TabValue;
  return "overview";
}

function actionByStatus(status: OutboundOrder["status"]): OutboundAction | null {
  if (status === "draft") return "allocate";
  if (status === "allocated" || status === "picking") return "pack";
  if (status === "packing" || status === "packed") return "ship";
  return null;
}

function actionLabel(action: OutboundAction) {
  if (action === "allocate") return "Allocate";
  if (action === "pack") return "Pack";
  return "Ship";
}

export function OutboundDetailView({
  order: initialOrder,
  initialTab,
}: {
  order: OutboundOrder;
  initialTab?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const { t } = useI18n();

  const [order, setOrder] = useState(initialOrder);
  const [tab, setTab] = useState<TabValue>(normalizeTab(initialTab));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [boxNo, setBoxNo] = useState("");
  const [courier, setCourier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [itemCount, setItemCount] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<OutboundAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentAction = actionByStatus(order.status);

  const setTabWithQuery = (nextTab: string) => {
    const normalized = normalizeTab(nextTab);
    setTab(normalized);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", normalized);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const openActionConfirm = () => {
    if (!currentAction) return;
    setPendingAction(currentAction);
    setConfirmOpen(true);
  };

  const runStatusAction = async () => {
    if (!pendingAction) return;

    setLoading(true);
    try {
      const updated = await transitionOutboundStatus(order.outbound_no, pendingAction);
      setOrder(updated);
      setConfirmOpen(false);
      pushToast({
        title: `${t(actionLabel(pendingAction))} ${t("completed")}`,
        description: `${t("Order status changed to")} ${t(updated.status)}.`,
        variant: "success",
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("Action failed");
      pushToast({ title: t("Action failed"), description: message, variant: "error" });
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  const itemColumns = useMemo(
    () => [
      { key: "barcode_full", label: "barcode_full", render: (row: OutboundOrder["items"][number]) => row.barcode_full },
      { key: "product_name", label: "product_name", render: (row: OutboundOrder["items"][number]) => row.product_name },
      { key: "lot", label: "lot", render: (row: OutboundOrder["items"][number]) => row.lot },
      { key: "location", label: "location", render: (row: OutboundOrder["items"][number]) => row.location },
      {
        key: "requested_qty",
        label: "requested_qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.requested_qty,
      },
      {
        key: "picked_qty",
        label: "picked_qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.picked_qty,
      },
      {
        key: "available_qty",
        label: "available_qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.available_qty,
      },
      {
        key: "status",
        label: "status",
        render: (row: OutboundOrder["items"][number]) =>
          row.available_qty < row.requested_qty ? (
            <Badge variant="danger" className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t("Shortage")}
            </Badge>
          ) : (
            <Badge variant={row.status === "picked" ? "success" : "default"}>{t(row.status)}</Badge>
          ),
      },
    ],
    [t]
  );

  const submitBox = async () => {
    const parsedItemCount = Number(itemCount);
    if (!boxNo.trim() || !courier.trim() || !trackingNo.trim()) {
      setFormError(t("All fields are required."));
      return;
    }
    if (!Number.isFinite(parsedItemCount) || parsedItemCount < 1) {
      setFormError(t("Item count must be 1 or greater."));
      return;
    }

    setFormError(null);
    setLoading(true);
    try {
      const boxes = await addOutboundBox(order.outbound_no, {
        box_no: boxNo.trim(),
        courier: courier.trim(),
        tracking_no: trackingNo.trim(),
        item_count: parsedItemCount,
      });
      setOrder((prev) => ({ ...prev, boxes }));
      setDialogOpen(false);
      setBoxNo("");
      setCourier("");
      setTrackingNo("");
      setItemCount("1");
      pushToast({ title: t("Box added"), variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("Please check input values or API status.");
      pushToast({ title: t("Failed to add box"), description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[
          { label: "Operations" },
          { label: "Outbounds", href: "/outbounds" },
          { label: order.outbound_no },
        ]}
        title={order.outbound_no}
        subtitle={`${order.client} | ${t("ETA")} ${order.eta_date}`}
        rightSlot={
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            {currentAction && (
              <Button onClick={openActionConfirm} disabled={loading}>
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
          <TabsTrigger value="boxes">{t("Boxes")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("Timeline")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{t("Client")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{order.client}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Shipping Address")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{order.ship_to}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">{order.summary}</p>
              <p className="text-sm text-slate-500">{order.memo}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <DataTable rows={order.items} columns={itemColumns} emptyText={t("No items available.")} />
        </TabsContent>

        <TabsContent value="boxes">
          <div className="mb-4 flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" disabled={!order.boxes_supported} title={!order.boxes_supported ? t("Box API is unavailable in current backend.") : undefined}>
                  <PackagePlus className="h-4 w-4" />
                  {t("Add Box")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("Add Box")}</DialogTitle>
                  <DialogDescription>{t("Mock form with client-side validation.")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input placeholder={t("Box No")} value={boxNo} onChange={(e) => setBoxNo(e.target.value)} />
                  <Input placeholder={t("Courier")} value={courier} onChange={(e) => setCourier(e.target.value)} />
                  <Input placeholder={t("Tracking No")} value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
                  <Input
                    placeholder={t("Item Count")}
                    type="number"
                    min={1}
                    value={itemCount}
                    onChange={(e) => setItemCount(e.target.value)}
                  />
                  {formError && <p className="text-sm text-red-600">{formError}</p>}
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={loading}>
                    {t("Cancel")}
                  </Button>
                  <Button onClick={submitBox} disabled={loading}>
                    {loading ? t("Saving...") : t("Save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <DataTable
            rows={order.boxes}
            columns={[
              { key: "box_no", label: "Box No", render: (row) => row.box_no },
              { key: "courier", label: "Courier", render: (row) => row.courier },
              { key: "tracking_no", label: "Tracking No", render: (row) => row.tracking_no },
              {
                key: "item_count",
                label: "Item Count",
                className: "tabular-nums",
                render: (row) => row.item_count,
              },
            ]}
            emptyText="No boxes packed yet."
          />
          {!order.boxes_supported && (
            <p className="mt-3 text-sm text-amber-700">
              {t("Box API is unavailable on current backend, so box create/update is disabled.")}
            </p>
          )}
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
                    <p className="text-sm font-medium">{log.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                      {log.at} | {log.actor}
                    </p>
                    {log.note && <p className="mt-1 text-sm text-slate-600">{log.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Confirm")} {pendingAction ? t(actionLabel(pendingAction)) : t("Action")}</DialogTitle>
            <DialogDescription>
              {t("This changes outbound status and appends a timeline log in mock data.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={loading}>
              {t("Cancel")}
            </Button>
            <Button onClick={runStatusAction} disabled={loading || !pendingAction}>
              {loading ? t("Processing...") : t("Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}


