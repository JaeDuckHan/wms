"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import { BillingTabs } from "@/components/billing/BillingTabs";
import {
  billingEventsCsvUrl,
  listBillingEvents,
  listServiceRates,
  markBillingEventsPending,
  type BillingEvent,
} from "@/features/billing/api";
import { listClients } from "@/features/settings/clients/api";
import { useI18n } from "@/lib/i18n/I18nProvider";

function currentYear() {
  return String(new Date().getFullYear());
}

export function BillingEventsPage() {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const { isAdmin, canAccessBillingEvents, ready } = useCurrentUser();
  const [rows, setRows] = useState<BillingEvent[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; client_code: string; name: string }>>([]);
  const [serviceLabels, setServiceLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const normalizedYear = /^\d{4}$/.test(year) ? year : currentYear();
  const selectedInvoiceMonth = month && /^\d{2}$/.test(month) ? `${normalizedYear}-${month}` : undefined;
  const selectedClient = useMemo(
    () => clients.find((item) => item.id === clientId.trim()) ?? null,
    [clients, clientId]
  );

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBillingEvents({
        invoice_month: selectedInvoiceMonth,
        invoice_year: !selectedInvoiceMonth ? normalizedYear : undefined,
        client_id: clientId ? Number(clientId) : undefined,
        status: (status as "PENDING" | "INVOICED") || undefined,
        service_code: serviceCode || undefined,
      });
      setRows(data);
      setSelectedIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Failed to load billing events."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !canAccessBillingEvents) return;
    void reload();
  }, [ready, canAccessBillingEvents]);

  useEffect(() => {
    if (!ready || !canAccessBillingEvents) return;
    void listClients()
      .then((data) => setClients(data.map((item) => ({ id: item.id, client_code: item.client_code, name: item.name }))))
      .catch(() => setClients([]));
  }, [ready, canAccessBillingEvents]);

  useEffect(() => {
    if (!ready || !canAccessBillingEvents) return;
    void listServiceRates()
      .then((data) => setServiceLabels(new Map(data.map((item) => [item.service_code, `${item.service_code} | ${item.service_name}`]))))
      .catch(() => setServiceLabels(new Map()));
  }, [ready, canAccessBillingEvents]);

  const accessDenied = ready && !canAccessBillingEvents;

  const csvHref = useMemo(
    () =>
      billingEventsCsvUrl({
        invoice_month: selectedInvoiceMonth,
        invoice_year: !selectedInvoiceMonth ? normalizedYear : undefined,
        client_id: clientId ? Number(clientId) : undefined,
        status: (status as "PENDING" | "INVOICED") || undefined,
        service_code: serviceCode || undefined,
      }),
    [year, month, normalizedYear, selectedInvoiceMonth, clientId, status, serviceCode]
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const onBulkMarkPending = async () => {
    if (!selectedIds.length) {
      pushToast({ title: t("Select at least one event."), variant: "info" });
      return;
    }
    try {
      const result = await markBillingEventsPending(selectedIds);
      pushToast({ title: `${t("Updated")} ${result.updated} ${t("events")}`, variant: "success" });
      await reload();
    } catch (e) {
      pushToast({ title: t("Bulk update failed"), description: e instanceof Error ? e.message : "", variant: "error" });
    }
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Billing" }, { label: "Billing Events" }]}
        title="Billing Events"
        subtitle="Review pending/invoiced billing events before monthly KRW invoice generation."
      />
      <BillingTabs />
      {accessDenied ? (
        <div className="rounded-xl border bg-white p-6">
          <ErrorState
            title={t("Access denied")}
            message={t("Customer accounts can only access invoices.")}
          />
        </div>
      ) : null}
      {accessDenied ? null : (
        <>
      <div className="mb-4 rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <Input type="number" placeholder="Year (YYYY)" value={year} onChange={(e) => setYear(e.target.value.slice(0, 4))} />
          <select className="h-9 rounded-md border px-3 text-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All months</option>
            {Array.from({ length: 12 }, (_, idx) => {
              const mm = String(idx + 1).padStart(2, "0");
              return (
                <option key={mm} value={mm}>
                  {mm}
                </option>
              );
            })}
          </select>
          <select className="h-9 rounded-md border px-3 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">{t("All clients")}</option>
            {clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.client_code} | {item.name}
              </option>
            ))}
          </select>
          <select className="h-9 rounded-md border px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("All status")}</option>
            <option value="PENDING">{t("PENDING")}</option>
            <option value="INVOICED">{t("INVOICED")}</option>
          </select>
          <Input placeholder="Service code" value={serviceCode} onChange={(e) => setServiceCode(e.target.value.toUpperCase())} />
          <Button variant="secondary" onClick={() => void reload()}>Search</Button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          기본 조회는 올해 전체입니다. 특정 월만 보려면 월을 함께 선택합니다.
          {selectedClient ? ` 현재 고객: ${selectedClient.client_code} | ${selectedClient.name}` : ""}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={csvHref} className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50">{t("Export CSV")}</a>
          {isAdmin && (
            <Button variant="secondary" onClick={() => void onBulkMarkPending()}>
              {t("Mark as Pending (Admin)")}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        {error ? (
          <ErrorState title={t("Failed to load billing events")} message={error} onRetry={() => void reload()} />
        ) : (
          <DataTable
            rows={rows}
            emptyText={loading ? t("Loading...") : t("No billing events")}
            columns={[
              {
                key: "select",
                label: "",
                render: (row) =>
                  isAdmin ? (
                    <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelect(row.id)} />
                  ) : (
                    ""
                  ),
              },
              { key: "event_date", label: "Event Date", render: (row) => row.display_date_kst ?? row.event_date.slice(0, 10) },
              { key: "client", label: "Client", render: (row) => `${row.client_code} | ${row.name_kr}` },
              { key: "service_code", label: "Service", render: (row) => serviceLabels.get(row.service_code) ?? row.service_code },
              { key: "qty", label: "Qty", render: (row) => Number(row.qty).toLocaleString() },
              { key: "amount_thb", label: "Charge THB", render: (row) => (row.amount_thb == null ? "-" : Number(row.amount_thb).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) },
              { key: "fx_rate_thbkrw", label: "FX", render: (row) => (row.fx_rate_thbkrw == null ? "-" : Number(row.fx_rate_thbkrw).toFixed(4)) },
              { key: "amount_krw", label: "KRW Equivalent", render: (row) => (row.amount_krw == null ? "-" : Number(row.amount_krw).toLocaleString()) },
              { key: "reference_type", label: "Ref Type", render: (row) => row.reference_type },
              { key: "reference_id", label: "Ref ID", render: (row) => row.reference_id || "-" },
              { key: "status", label: "Status", render: (row) => row.status },
            ]}
          />
        )}
      </div>
        </>
      )}
    </section>
  );
}




