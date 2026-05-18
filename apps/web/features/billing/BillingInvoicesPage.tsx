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
import { formatThbKrwRate } from "@/features/billing/format";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import { listClients } from "@/features/settings/clients/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearsAgoIso(yearsAgo = 3) {
  const d = new Date();
  return `${d.getFullYear() - yearsAgo}-01-01`;
}

function normalizeDate(value: string) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

type PendingInvoiceAction = {
  type: "issue" | "markPaid";
  id: number;
  invoiceNo: string;
} | null;

export function BillingInvoicesPage() {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const { isAdmin } = useCurrentUser();
  const canManageInvoices = isAdmin;
  const [rows, setRows] = useState<BillingInvoice[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; client_code: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientIdInput, setClientIdInput] = useState("");
  const [fromDateInput, setFromDateInput] = useState(startOfYearsAgoIso());
  const [toDateInput, setToDateInput] = useState(todayIso());
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
  const parsedClientId = Number(clientIdInput || 0);
  const selectedClientId = Number.isFinite(parsedClientId) && parsedClientId > 0 ? Math.trunc(parsedClientId) : null;
  const selectedClient = useMemo(
    () => clients.find((item) => item.id === String(selectedClientId ?? "")) ?? null,
    [clients, selectedClientId]
  );

  const dateRange = useMemo(() => {
    const fromDate = normalizeDate(fromDateInput);
    const toDate = normalizeDate(toDateInput);
    if (!fromDate || !toDate) {
      return { fromDate: null, toDate: null, valid: false, message: t("billingInvoices.dateSelectRequired") };
    }
    if (fromDate > toDate) {
      return { fromDate, toDate, valid: false, message: t("billingInvoices.dateRangeInvalid") };
    }
    return { fromDate, toDate, valid: true, message: "" };
  }, [fromDateInput, toDateInput, t]);

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
          client_id: selectedClientId || undefined,
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

  useEffect(() => {
    void listClients()
      .then((data) => setClients(data.map((item) => ({ id: item.id, client_code: item.client_code, name: item.name }))))
      .catch(() => setClients([]));
  }, []);

  const onGenerate = async (regenerateDraft: 0 | 1) => {
    if (!dateRange.valid) {
      pushToast({ title: t("billingInvoices.rangeErrorTitle"), description: dateRange.message, variant: "error" });
      return;
    }
    if (!selectedClientId) {
      pushToast({ title: "Client ID required", description: "인보이스 생성은 Client ID를 입력해야 합니다.", variant: "error" });
      return;
    }

    try {
      const result = await generateBillingInvoice({
        client_id: selectedClientId,
        invoice_month: derivedInvoiceMonth,
        invoice_date: derivedInvoiceDate,
        regenerate_draft: regenerateDraft,
      });
      if (result.reused) {
        pushToast({
          title: t("Draft already exists"),
          description: `client=${selectedClientId}, month=${derivedInvoiceMonth} draft reused.`,
          variant: "info",
        });
      } else {
        pushToast({
          title: t("Invoice generated"),
          description: `client=${selectedClientId}, month=${derivedInvoiceMonth}, invoice_date=${derivedInvoiceDate}`,
          variant: "success",
        });
      }
      await reload();
    } catch (e) {
      pushToast({ title: t("Generate failed"), description: e instanceof Error ? e.message : "", variant: "error" });
    }
  };

  const onSeed = async () => {
    if (!selectedClientId) {
      pushToast({ title: "Client ID required", description: "샘플 생성은 Client ID를 입력해야 합니다.", variant: "error" });
      return;
    }
    setSeedLoading(true);
    try {
      const result = await seedBillingEvents({ client_id: selectedClientId, invoice_month: derivedInvoiceMonth });
      pushToast({
        title: t("Sample events created"),
        description: `Inserted ${Number(result.inserted_count ?? 0)} events. month=${derivedInvoiceMonth}, client=${selectedClientId}`,
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
    if (!selectedClientId) {
      pushToast({ title: "Client ID required", description: "정리 대상 확인은 Client ID를 입력해야 합니다.", variant: "error" });
      return;
    }
    setCleanupConfirmOpen(true);
    setSampleCountLoading(true);
    try {
      const eventRows = await listBillingEvents({ client_id: selectedClientId, invoice_month: derivedInvoiceMonth });
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
    if (!selectedClientId) {
      pushToast({ title: "Client ID required", description: "샘플 정리는 Client ID를 입력해야 합니다.", variant: "error" });
      return;
    }
    setCleanupLoading(true);
    try {
      const result = await cleanupSampleBillingEvents({ client_id: selectedClientId, invoice_month: derivedInvoiceMonth });
      pushToast({
        title: "Sample cleanup completed",
        description: `Removed ${Number(result.removed_count ?? 0)} events. month=${derivedInvoiceMonth}, client=${selectedClientId}`,
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
        subtitle={t("billingInvoices.subtitle")}
      />
      <BillingTabs />

      <div className="mb-4 rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <select className="h-9 rounded-md border px-3 text-sm" value={clientIdInput} onChange={(e) => setClientIdInput(e.target.value)}>
            <option value="">{t("All clients")}</option>
            {clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.client_code} | {item.name}
              </option>
            ))}
          </select>
          <Input type="date" value={fromDateInput} onChange={(e) => setFromDateInput(e.target.value)} />
          <Input type="date" value={toDateInput} onChange={(e) => setToDateInput(e.target.value)} />
          <select className="h-9 rounded-md border px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("All status")}</option>
            <option value="draft">{t("draft")}</option>
            <option value="issued">{t("issued")}</option>
            <option value="paid">{t("paid")}</option>
          </select>
          <Button variant="secondary" onClick={() => void reload()}>{t("Search")}</Button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {dateRange.valid
            ? `${t("billingInvoices.rangePrefix")}: ${dateRange.fromDate} ~ ${dateRange.toDate} | ${t("billingInvoices.baseDatePrefix")}: ${derivedInvoiceDate}`
            : dateRange.message}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {selectedClient
            ? `현재 고객: ${selectedClient.client_code} | ${selectedClient.name}`
            : "Client ID는 Settings > Clients에서 고객사 코드와 회사명을 함께 확인할 수 있습니다."}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void onGenerate(0)} disabled={!canManageInvoices}>{t("Generate")}</Button>
          <Button variant="secondary" onClick={() => setRegenConfirmOpen(true)} disabled={!canManageInvoices}>{t("Re-generate Draft")}</Button>
          <Button variant="ghost" onClick={() => setSeedConfirmOpen(true)} disabled={!canManageInvoices}>{t("Create Sample Events")}</Button>
          <Button variant="ghost" onClick={() => void openCleanupConfirm()} disabled={!canManageInvoices}>Sample Data Cleanup</Button>
        </div>
        {!canManageInvoices ? <div className="mt-2 text-xs text-amber-700">Admin-only: invoice write actions are disabled.</div> : null}
      </div>

      <Dialog open={seedConfirmOpen} onOpenChange={setSeedConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sample Event Generation</DialogTitle>
            <DialogDescription>
              This will create sample billing events for client={selectedClientId ?? "-"}, month={derivedInvoiceMonth}.
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
              This will re-calculate the draft for client={selectedClientId ?? "-"}, month={derivedInvoiceMonth}, invoice_date={derivedInvoiceDate}.
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
              This removes only non-invoiced SAMPLE events for client={selectedClientId ?? "-"}, month={derivedInvoiceMonth}.
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
              { key: "client", label: "Client", render: (row) => `${row.client_code} | ${row.name_kr}` },
              { key: "date", label: "Date", render: (row) => row.display_date_kst ?? row.invoice_date },
              { key: "invoice_month", label: "Invoice Month", render: (row) => row.invoice_month },
              { key: "total_thb", label: "Total THB", render: (row) => <span className="font-semibold">{Number(row.total_thb ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
              { key: "fx", label: "FX", render: (row) => formatThbKrwRate(row.fx_rate_thbkrw) },
              { key: "total", label: "KRW Equivalent", render: (row) => Number(row.total_krw).toLocaleString() },
              { key: "status", label: "Status", render: (row) => row.status },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex gap-2">
                    {canManageInvoices && row.status === "draft" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openInvoiceActionConfirm("issue", row.id, row.invoice_no)}
                        disabled={actingId === row.id || actionLoading}
                      >
                        {t("Issue")}
                      </Button>
                    )}
                    {canManageInvoices && row.status === "issued" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openInvoiceActionConfirm("markPaid", row.id, row.invoice_no)}
                        disabled={actingId === row.id || actionLoading}
                      >
                        {t("Mark Paid")}
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
