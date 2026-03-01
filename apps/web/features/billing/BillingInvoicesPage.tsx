"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/toast";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BillingTabs } from "@/components/billing/BillingTabs";
import {
  cleanupSampleBillingEvents,
  generateBillingInvoice,
  issueBillingInvoice,
  listBillingEvents,
  listBillingInvoices,
  markBillingInvoicePaid,
  seedBillingEvents,
  type BillingInvoice,
} from "@/features/billing/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentYearText() {
  return String(new Date().getFullYear());
}

function currentMonthDay() {
  return new Date().toISOString().slice(5, 10);
}

function normalizeMonthDay(value: string) {
  const text = String(value || "").trim();
  if (!/^\d{2}-\d{2}$/.test(text)) return null;
  const [mm, dd] = text.split("-").map(Number);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return text;
}

function toDateFromYearMd(year: string, md: string) {
  const normalizedYear = /^\d{4}$/.test(year) ? year : currentYearText();
  const normalizedMd = normalizeMonthDay(md);
  if (!normalizedMd) return null;
  const result = `${normalizedYear}-${normalizedMd}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : null;
}

type PendingInvoiceAction = {
  type: "issue" | "markPaid";
  id: number;
  invoiceNo: string;
} | null;

export function BillingInvoicesPage() {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const [rows, setRows] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(1);
  const [year, setYear] = useState(currentYearText());
  const [fromMd, setFromMd] = useState("01-01");
  const [toMd, setToMd] = useState(currentMonthDay());
  const [status, setStatus] = useState("");

  const [actingId, setActingId] = useState<number | null>(null);

  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);
  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);

  const [seedLoading, setSeedLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [sampleRemovableCount, setSampleRemovableCount] = useState(0);
  const [sampleCountLoading, setSampleCountLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingInvoiceAction>(null);

  const dateRange = useMemo(() => {
    const fromDate = toDateFromYearMd(year, fromMd);
    const toDate = toDateFromYearMd(year, toMd);
    if (!fromDate || !toDate) return { fromDate: null, toDate: null, valid: false, message: "MM-DD 형식으로 입력하세요." };
    if (fromDate > toDate) return { fromDate, toDate, valid: false, message: "시작일은 종료일보다 클 수 없습니다." };
    return { fromDate, toDate, valid: true, message: "" };
  }, [year, fromMd, toMd]);

  const derivedInvoiceDate = dateRange.toDate || todayIso();
  const derivedInvoiceMonth = derivedInvoiceDate.slice(0, 7);

  const reload = async () => {
    if (!dateRange.valid) {
      setError(dateRange.message);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setRows(
        await listBillingInvoices({
          client_id: clientId,
          invoice_date_from: dateRange.fromDate || undefined,
          invoice_date_to: dateRange.toDate || undefined,
          status: status || undefined,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Failed to load invoices."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const onGenerate = async (regenerateDraft: 0 | 1) => {
    if (!dateRange.valid) {
      pushToast({ title: "기간 형식 오류", description: dateRange.message, variant: "error" });
      return;
    }

    try {
      const result = await generateBillingInvoice({
        client_id: clientId,
        invoice_month: derivedInvoiceMonth,
        invoice_date: derivedInvoiceDate,
        regenerate_draft: regenerateDraft,
      });
      if (result.reused) {
        pushToast({
          title: t("Draft already exists"),
          description: `client=${clientId}, month=${derivedInvoiceMonth} draft reused.`,
          variant: "info",
        });
      } else {
        pushToast({
          title: t("Invoice generated"),
          description: `client=${clientId}, month=${derivedInvoiceMonth}, invoice_date=${derivedInvoiceDate}`,
          variant: "success",
        });
      }
      await reload();
    } catch (e) {
      pushToast({ title: t("Generate failed"), description: e instanceof Error ? e.message : "", variant: "error" });
    }
  };

  const onSeed = async () => {
    setSeedLoading(true);
    try {
      const result = await seedBillingEvents({ client_id: clientId, invoice_month: derivedInvoiceMonth });
      pushToast({
        title: t("Sample events created"),
        description: `Inserted ${Number(result.inserted_count ?? 0)} events. month=${derivedInvoiceMonth}, client=${clientId}`,
        variant: "success",
      });
      setSeedConfirmOpen(false);
    } catch (e) {
      pushToast({ title: t("Seed failed"), description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSeedLoading(false);
    }
  };

  const openCleanupConfirm = async () => {
    setCleanupConfirmOpen(true);
    setSampleCountLoading(true);
    try {
      const eventRows = await listBillingEvents({ client_id: clientId, invoice_month: derivedInvoiceMonth });
      const count = eventRows.filter(
        (row) => String(row.reference_id || "").startsWith("SAMPLE-") && row.invoice_id == null
      ).length;
      setSampleRemovableCount(count);
    } catch {
      setSampleRemovableCount(0);
    } finally {
      setSampleCountLoading(false);
    }
  };

  const onCleanupSample = async () => {
    setCleanupLoading(true);
    try {
      const result = await cleanupSampleBillingEvents({ client_id: clientId, invoice_month: derivedInvoiceMonth });
      pushToast({
        title: "Sample cleanup completed",
        description: `Removed ${Number(result.removed_count ?? 0)} events. month=${derivedInvoiceMonth}, client=${clientId}`,
        variant: "success",
      });
      setCleanupConfirmOpen(false);
    } catch (e) {
      pushToast({ title: "Sample cleanup failed", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setCleanupLoading(false);
    }
  };

  const openInvoiceActionConfirm = (type: "issue" | "markPaid", id: number, invoiceNo: string) => {
    setPendingAction({ type, id, invoiceNo });
    setActionConfirmOpen(true);
  };

  const runIssue = async (id: number) => {
    setActingId(id);
    await issueBillingInvoice(id);
    pushToast({ title: t("Invoice issued"), variant: "success" });
    await reload();
    setActingId(null);
  };

  const runMarkPaid = async (id: number) => {
    setActingId(id);
    await markBillingInvoicePaid(id);
    pushToast({ title: t("Invoice marked paid"), variant: "success" });
    await reload();
    setActingId(null);
  };

  const onConfirmInvoiceAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      if (pendingAction.type === "issue") {
        await runIssue(pendingAction.id);
      } else {
        await runMarkPaid(pendingAction.id);
      }
      setActionConfirmOpen(false);
      setPendingAction(null);
    } catch (e) {
      pushToast({
        title: pendingAction.type === "issue" ? t("Issue failed") : t("Mark paid failed"),
        description: e instanceof Error ? e.message : "",
        variant: "error",
      });
    } finally {
      setActionLoading(false);
      setActingId(null);
    }
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Billing" }, { label: "Invoices" }]}
        title="Invoices"
        subtitle="Search by year + MM-DD range. Invoice generation uses end-date month and end-date FX basis."
      />
      <BillingTabs />

      <div className="mb-4 rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <Input type="number" placeholder="Client ID" value={clientId} onChange={(e) => setClientId(Number(e.target.value || 0))} />
          <Input type="number" placeholder="Year (YYYY)" value={year} onChange={(e) => setYear(e.target.value)} />
          <Input placeholder="From MM-DD" value={fromMd} onChange={(e) => setFromMd(e.target.value)} />
          <Input placeholder="To MM-DD" value={toMd} onChange={(e) => setToMd(e.target.value)} />
          <select className="h-9 rounded-md border px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("All status")}</option>
            <option value="draft">{t("draft")}</option>
            <option value="issued">{t("issued")}</option>
            <option value="paid">{t("paid")}</option>
          </select>
          <Button variant="secondary" onClick={() => void reload()}>Search</Button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {dateRange.valid
            ? `검색기간: ${dateRange.fromDate} ~ ${dateRange.toDate} | 생성기준일(종료일): ${derivedInvoiceDate}`
            : dateRange.message}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void onGenerate(0)}>{t("Generate")}</Button>
          <Button variant="secondary" onClick={() => setRegenConfirmOpen(true)}>{t("Re-generate Draft")}</Button>
          <Button variant="ghost" onClick={() => setSeedConfirmOpen(true)}>{t("Create Sample Events")}</Button>
          <Button variant="ghost" onClick={() => void openCleanupConfirm()}>Sample Data Cleanup</Button>
        </div>
      </div>

      <Dialog open={seedConfirmOpen} onOpenChange={setSeedConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sample Event Generation</DialogTitle>
            <DialogDescription>
              This will create sample billing events for client={clientId}, month={derivedInvoiceMonth}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSeedConfirmOpen(false)} disabled={seedLoading}>Cancel</Button>
            <Button onClick={() => void onSeed()} disabled={seedLoading}>{seedLoading ? "Generating..." : "Confirm Generate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regenConfirmOpen} onOpenChange={setRegenConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Draft Re-generation</DialogTitle>
            <DialogDescription>
              This will re-calculate the draft for client={clientId}, month={derivedInvoiceMonth}, invoice_date={derivedInvoiceDate}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRegenConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setRegenConfirmOpen(false);
                void onGenerate(1);
              }}
            >
              Confirm Re-generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cleanupConfirmOpen} onOpenChange={setCleanupConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sample Data Cleanup</DialogTitle>
            <DialogDescription>
              This removes only non-invoiced SAMPLE events for client={clientId}, month={derivedInvoiceMonth}.
              {sampleCountLoading ? " Counting targets..." : ` Target rows: ${sampleRemovableCount}`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCleanupConfirmOpen(false)} disabled={cleanupLoading}>Cancel</Button>
            <Button onClick={() => void onCleanupSample()} disabled={cleanupLoading}>{cleanupLoading ? "Cleaning..." : "Confirm Cleanup"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionConfirmOpen} onOpenChange={setActionConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "issue" ? "Issue Confirmation" : "Mark Paid Confirmation"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction
                ? `Invoice ${pendingAction.invoiceNo} (${pendingAction.id}) action: ${pendingAction.type === "issue" ? "issue" : "mark paid"}.`
                : "Please confirm action."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setActionConfirmOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button onClick={() => void onConfirmInvoiceAction()} disabled={actionLoading}>
              {actionLoading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border bg-white p-6">
        {error ? (
          <ErrorState title={t("Failed to load invoices")} message={error} onRetry={() => void reload()} />
        ) : (
          <DataTable
            rows={rows}
            emptyText={loading ? t("Loading...") : t("No invoices")}
            columns={[
              { key: "invoice_no", label: "Invoice No", render: (row) => <Link href={`/billing/${row.id}`} className="font-medium hover:underline">{row.invoice_no}</Link> },
              { key: "client", label: "Client", render: (row) => `${row.client_code} (${row.client_id})` },
              { key: "date", label: "Date", render: (row) => row.invoice_date },
              { key: "fx", label: "FX", render: (row) => Number(row.fx_rate_thbkrw).toFixed(4) },
              { key: "subtotal_thb", label: "Original THB", render: (row) => Number(row.subtotal_thb ?? 0).toLocaleString() },
              { key: "subtotal", label: "Subtotal", render: (row) => Number(row.subtotal_krw).toLocaleString() },
              { key: "vat", label: "VAT 7%", render: (row) => Number(row.vat_krw).toLocaleString() },
              { key: "total", label: "Total KRW", render: (row) => <span className="font-semibold">{Number(row.total_krw).toLocaleString()}</span> },
              { key: "status", label: "Status", render: (row) => row.status },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex gap-2">
                    {row.status === "draft" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openInvoiceActionConfirm("issue", row.id, row.invoice_no)}
                        disabled={actingId === row.id || actionLoading}
                      >
                        Issue
                      </Button>
                    )}
                    {row.status === "issued" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openInvoiceActionConfirm("markPaid", row.id, row.invoice_no)}
                        disabled={actingId === row.id || actionLoading}
                      >
                        Mark Paid
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>
    </section>
  );
}
