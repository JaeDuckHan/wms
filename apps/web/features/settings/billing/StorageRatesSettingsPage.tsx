"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/badge";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { useToast } from "@/components/ui/toast";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  createStorageRateSetting,
  deleteStorageRateSetting,
  listStorageRateSettings,
  type StorageRateSetting,
  updateStorageRateSetting,
} from "@/features/billing/api";

const blank: Omit<StorageRateSetting, "id"> = {
  warehouse_id: null,
  client_id: null,
  rate_cbm: 0,
  rate_pallet: 0,
  currency: "THB",
  effective_from: new Date().toISOString().slice(0, 10),
  status: "active",
};

function parseOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function StorageRatesSettingsPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<StorageRateSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [warehouseInput, setWarehouseInput] = useState("");
  const [clientInput, setClientInput] = useState("");
  const [form, setForm] = useState<Omit<StorageRateSetting, "id">>(blank);

  const counts = useMemo(() => {
    const active = rows.filter((row) => row.status === "active").length;
    return { total: rows.length, active, inactive: rows.length - active };
  }, [rows]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listStorageRateSettings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load storage rates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const startCreate = () => {
    setEditingId(null);
    setWarehouseInput("");
    setClientInput("");
    setForm(blank);
  };

  const startEdit = (row: StorageRateSetting) => {
    setEditingId(row.id);
    setWarehouseInput(row.warehouse_id == null ? "" : String(row.warehouse_id));
    setClientInput(row.client_id == null ? "" : String(row.client_id));
    setForm({ ...row });
  };

  const save = async () => {
    const payload: Omit<StorageRateSetting, "id"> = {
      ...form,
      warehouse_id: parseOptionalInt(warehouseInput),
      client_id: parseOptionalInt(clientInput),
      currency: form.currency.toUpperCase(),
      rate_cbm: Number(form.rate_cbm || 0),
      rate_pallet: Number(form.rate_pallet || 0),
    };

    if (!payload.effective_from.trim()) {
      pushToast({ title: "Effective date is required.", variant: "error" });
      return;
    }

    try {
      if (editingId) {
        await updateStorageRateSetting(editingId, payload);
      } else {
        await createStorageRateSetting(payload);
      }
      pushToast({ title: "Saved", variant: "success" });
      await reload();
      startCreate();
    } catch (e) {
      pushToast({ title: "Save failed", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  };

  const remove = async (id: number) => {
    try {
      await deleteStorageRateSetting(id);
      pushToast({ title: "Deleted", variant: "info" });
      await reload();
      if (editingId === id) startCreate();
    } catch (e) {
      pushToast({ title: "Delete failed", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }, { label: "Storage Rates" }]}
        title="Storage Rates"
        subtitle="Configure CBM/Pallet rates with priority scope (warehouse+client, warehouse, client, global)."
      />
      <SettingsTabs />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="default">{`All: ${counts.total}`}</Badge>
            <Badge variant="success">{`active: ${counts.active}`}</Badge>
            <Badge variant="warning">{`inactive: ${counts.inactive}`}</Badge>
          </div>
          {error ? (
            <ErrorState title="Failed to load storage rates" message={error} onRetry={() => void reload()} />
          ) : (
            <DataTable
              rows={rows}
              emptyText={loading ? "Loading..." : "No storage rates"}
              columns={[
                { key: "warehouse_id", label: "Warehouse", render: (row) => row.warehouse_id ?? "GLOBAL" },
                { key: "client_id", label: "Client", render: (row) => row.client_id ?? "GLOBAL" },
                { key: "rate_cbm", label: "Rate CBM", render: (row) => Number(row.rate_cbm).toLocaleString() },
                { key: "rate_pallet", label: "Rate Pallet", render: (row) => Number(row.rate_pallet).toLocaleString() },
                { key: "currency", label: "Currency", render: (row) => row.currency },
                { key: "effective_from", label: "Effective", render: (row) => row.effective_from },
                { key: "status", label: "Status", render: (row) => row.status },
                {
                  key: "actions",
                  label: "Actions",
                  render: (row) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => startEdit(row)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => void remove(row.id)}>Delete</Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>

        <div className="rounded-xl border bg-white p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editingId ? "Edit storage rate" : "New storage rate"}</h3>
            {editingId && <Button size="sm" variant="ghost" onClick={startCreate}>Reset</Button>}
          </div>
          <Input placeholder="Warehouse ID (blank = global/client scope)" value={warehouseInput} onChange={(e) => setWarehouseInput(e.target.value.replace(/[^\d]/g, ""))} />
          <Input placeholder="Client ID (blank = global/warehouse scope)" value={clientInput} onChange={(e) => setClientInput(e.target.value.replace(/[^\d]/g, ""))} />
          <Input type="number" placeholder="rate_cbm" value={form.rate_cbm} onChange={(e) => setForm((p) => ({ ...p, rate_cbm: Number(e.target.value || 0) }))} />
          <Input type="number" placeholder="rate_pallet" value={form.rate_pallet} onChange={(e) => setForm((p) => ({ ...p, rate_pallet: Number(e.target.value || 0) }))} />
          <Input placeholder="currency" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} />
          <Input type="date" value={form.effective_from} onChange={(e) => setForm((p) => ({ ...p, effective_from: e.target.value }))} />
          <select className="h-9 rounded-md border px-3 text-sm" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as StorageRateSetting["status"] }))}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          <Button onClick={() => void save()}>Save</Button>
        </div>
      </div>
    </section>
  );
}
