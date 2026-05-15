"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import { BillingTabs } from "@/components/billing/BillingTabs";
import {
  duplicateBillingInvoiceAdmin,
  exportBillingInvoicePdf,
  getBillingInvoice,
  issueBillingInvoice,
  markBillingInvoicePaid,
  type BillingInvoice,
  type BillingInvoiceItem,
} from "@/features/billing/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const { isAdmin } = useCurrentUser();
  const canManageInvoices = isAdmin;
  const [invoice, setInvoice] = useState<BillingInvoice | null>(null);
  const [items, setItems] = useState<BillingInvoiceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingInvoice(invoiceId);
      setInvoice(data.invoice);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Failed to load invoice."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [invoiceId]);

  const runExport = async () => {
    try {
      const result = await exportBillingInvoicePdf(invoiceId);
      if (result.download_url && typeof window !== "undefined") {
        window.open(`/api/proxy${result.download_url}`, "_blank", "noopener,noreferrer");
      }
      pushToast({ title: t("Export ready"), description: result.message, variant: "info" });
    } catch (e) {
      pushToast({ title: t("Export failed"), description: e instanceof Error ? e.message : "", variant: "error" });
    }
  };

  const runIssue = async () => {
    setActing(true);
    try {
      await issueBillingInvoice(invoiceId);
      pushToast({ title: t("Invoice issued"), variant: "success" });
      await load();
    } catch (e) {
      pushToast({ title: t("Issue failed"), description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setActing(false);
    }
  };

  const runMarkPaid = async () => {
    setActing(true);
    try {
      await markBillingInvoicePaid(invoiceId);
      pushToast({ title: t("Invoice marked paid"), variant: "success" });
      await load();
    } catch (e) {
      pushToast({ title: t("Mark paid failed"), description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setActing(false);
    }
  };

  const runDuplicateAdmin = async () => {
    setActing(true);
    try {
      const duplicated = await duplicateBillingInvoiceAdmin(invoiceId);
      pushToast({ title: `${t("Duplicated as")} ${duplicated.invoice_no}`, variant: "success" });
    } catch (e) {
      pushToast({ title: t("Duplicate failed"), description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setActing(false);
    }
  };

  if (error) {
    return <ErrorState title={t("Failed to load invoice")} message={error} onRetry={() => void load()} />;
  }

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Billing" }, { label: "Invoices" }, { label: invoice?.invoice_no ?? String(invoiceId) }]}
        title={invoice?.invoice_no ?? t("Invoice Detail")}
        subtitle={invoice ? `${t("Client")} ${invoice.client_code} | ${invoice.name_kr} | ${invoice.invoice_month}` : t("Loading...")}
        rightSlot={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void runExport()}>{t("Export Invoice")}</Button>
            {canManageInvoices && invoice?.status === "draft" && <Button onClick={() => void runIssue()} disabled={acting}>Issue</Button>}
            {canManageInvoices && invoice?.status === "issued" && <Button onClick={() => void runMarkPaid()} disabled={acting}>Mark Paid</Button>}
            {isAdmin && invoice?.status !== "draft" && (
              <Button variant="secondary" onClick={() => void runDuplicateAdmin()} disabled={acting}>
                {t("Duplicate (Admin)")}
              </Button>
            )}
          </div>
        }
      />
      <BillingTabs />

      {invoice && (
        <div className="mb-4 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-5">
          <div><p className="text-xs text-slate-500">Subtotal THB</p><p className="font-semibold">{Number(invoice.subtotal_thb ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB</p></div>
          <div><p className="text-xs text-slate-500">VAT 7% THB</p><p className="font-semibold">{Number(invoice.vat_thb ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB</p></div>
          <div><p className="text-xs text-slate-500">Total THB</p><p className="font-semibold">{Number(invoice.total_thb ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB</p></div>
          <div><p className="text-xs text-slate-500">{t("FX Rate")}</p><p className="font-semibold">{Number(invoice.fx_rate_thbkrw).toFixed(4)}</p></div>
          <div><p className="text-xs text-slate-500">KRW Equivalent</p><p className="font-semibold">{Number(invoice.total_krw).toLocaleString()} KRW</p></div>
        </div>
      )}

      <div className="rounded-xl border bg-white p-6">
        <DataTable
          rows={items}
          emptyText={loading ? t("Loading...") : t("No items")}
          columns={[
            { key: "service_code", label: "Code", render: (row) => `${row.service_code} | ${row.description}` },
            { key: "description", label: "Description", render: (row) => row.description },
            { key: "qty", label: "Qty", render: (row) => Number(row.qty).toLocaleString() },
            { key: "unit_price_thb", label: "Unit THB", render: (row) => `${Number(row.unit_price_thb ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB` },
            { key: "amount_thb", label: "Amount THB", render: (row) => <span className="font-semibold">{Number(row.amount_thb ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB</span> },
            { key: "amount_krw", label: "KRW Equivalent", render: (row) => `${Number(row.amount_krw).toLocaleString()} KRW` },
          ]}
        />
      </div>
    </section>
  );
}


