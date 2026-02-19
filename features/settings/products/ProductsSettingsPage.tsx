"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/DataTable";
import { ActiveStatusBadge } from "@/components/ui/ActiveStatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { useToast } from "@/components/ui/toast";
import { listClients } from "@/features/settings/clients/api";
import { buildBarcodeFull, createProduct, listProducts, toggleProductStatus, updateProduct } from "@/features/settings/products/api";
import type { Product, ProductStatus } from "@/features/settings/products/types";

type FormState = {
  client_code: string;
  barcode_raw: string;
  name: string;
  status: ProductStatus;
};

const initialForm: FormState = {
  client_code: "",
  barcode_raw: "",
  name: "",
  status: "active",
};

export function ProductsSettingsPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<Product[]>([]);
  const [clientCodes, setClientCodes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);

  const loadRows = async () => {
    const [products, clients] = await Promise.all([listProducts(), listClients()]);
    setRows(products);
    setClientCodes(clients.map((item) => item.client_code));
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const barcodePreview = useMemo(
    () => buildBarcodeFull(form.client_code, form.barcode_raw),
    [form.client_code, form.barcode_raw]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (item) =>
        item.client_code.toLowerCase().includes(q) ||
        item.barcode_raw.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setOpen(true);
  };

  const openEdit = (row: Product) => {
    setEditingId(row.id);
    setForm({
      client_code: row.client_code,
      barcode_raw: row.barcode_raw,
      name: row.name,
      status: row.status,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.client_code.trim() || !form.barcode_raw.trim() || !form.name.trim()) {
      pushToast({
        title: "Missing required fields",
        description: "Client code, barcode raw and name are required.",
        variant: "error",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateProduct(editingId, form);
        pushToast({ title: "Product updated", variant: "success" });
      } else {
        await createProduct(form);
        pushToast({ title: "Product created", variant: "success" });
      }
      await loadRows();
      setOpen(false);
    } catch (error) {
      pushToast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: Product) => {
    await toggleProductStatus(row.id);
    await loadRows();
    pushToast({
      title: row.status === "active" ? "Product archived" : "Product reactivated",
      variant: "info",
    });
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }, { label: "Products" }]}
        title="Products"
        subtitle="Maintain product catalog by client and barcode rules."
        rightSlot={<Button onClick={openCreate}>New</Button>}
      />
      <SettingsTabs />

      <div className="rounded-xl border bg-white p-6">
        <div className="mb-4">
          <Input
            placeholder="Search by product name, barcode, or client code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <DataTable
          rows={filteredRows}
          emptyText="No products found."
          rowClassName="cursor-pointer hover:bg-slate-50"
          columns={[
            { key: "client_code", label: "Client Code", render: (row) => <span className="font-medium">{row.client_code}</span> },
            { key: "barcode_raw", label: "Barcode Raw", render: (row) => row.barcode_raw },
            { key: "barcode_full", label: "Barcode Full", render: (row) => row.barcode_full },
            { key: "name", label: "Name", render: (row) => row.name },
            { key: "status", label: "Status", render: (row) => <ActiveStatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => void toggleStatus(row)}>
                    {row.status === "active" ? "Archive" : "Activate"}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit product" : "New product"}</DialogTitle>
            <DialogDescription>Unique key: client_code + barcode_raw.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Client Code</label>
              <Input
                list="client-code-options"
                value={form.client_code}
                onChange={(e) => setForm((prev) => ({ ...prev, client_code: e.target.value }))}
              />
              <datalist id="client-code-options">
                {clientCodes.map((code) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Barcode Raw</label>
              <Input value={form.barcode_raw} onChange={(e) => setForm((prev) => ({ ...prev, barcode_raw: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Name</label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Barcode Full (Preview)</p>
              <p className="mt-1 font-mono text-slate-700">{barcodePreview}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select
                className="h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ProductStatus }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
