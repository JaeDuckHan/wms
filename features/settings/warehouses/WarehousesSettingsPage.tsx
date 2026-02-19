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
import { createWarehouse, listWarehouses, toggleWarehouseStatus, updateWarehouse } from "@/features/settings/warehouses/api";
import type { Warehouse, WarehouseStatus } from "@/features/settings/warehouses/types";

type FormState = {
  warehouse_code: string;
  name: string;
  status: WarehouseStatus;
};

const initialForm: FormState = {
  warehouse_code: "",
  name: "",
  status: "active",
};

export function WarehousesSettingsPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);

  const loadRows = async () => {
    const data = await listWarehouses();
    setRows(data);
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (item) =>
        item.warehouse_code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setOpen(true);
  };

  const openEdit = (row: Warehouse) => {
    setEditingId(row.id);
    setForm({
      warehouse_code: row.warehouse_code,
      name: row.name,
      status: row.status,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.warehouse_code.trim() || !form.name.trim()) {
      pushToast({
        title: "Missing required fields",
        description: "Warehouse code and name are required.",
        variant: "error",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateWarehouse(editingId, form);
        pushToast({ title: "Warehouse updated", variant: "success" });
      } else {
        await createWarehouse(form);
        pushToast({ title: "Warehouse created", variant: "success" });
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

  const toggleStatus = async (row: Warehouse) => {
    await toggleWarehouseStatus(row.id);
    await loadRows();
    pushToast({
      title: row.status === "active" ? "Warehouse deactivated" : "Warehouse reactivated",
      variant: "info",
    });
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }, { label: "Warehouses" }]}
        title="Warehouses"
        subtitle="Configure warehouse master records used across operations."
        rightSlot={<Button onClick={openCreate}>New</Button>}
      />
      <SettingsTabs />

      <div className="rounded-xl border bg-white p-6">
        <div className="mb-4">
          <Input
            placeholder="Search by warehouse name or code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <DataTable
          rows={filteredRows}
          emptyText="No warehouses found."
          rowClassName="cursor-pointer hover:bg-slate-50"
          columns={[
            { key: "warehouse_code", label: "Warehouse Code", render: (row) => <span className="font-medium">{row.warehouse_code}</span> },
            { key: "name", label: "Name", render: (row) => row.name },
            { key: "status", label: "Status", render: (row) => <ActiveStatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => void toggleStatus(row)}>
                    {row.status === "active" ? "Deactivate" : "Activate"}
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
            <DialogTitle>{editingId ? "Edit warehouse" : "New warehouse"}</DialogTitle>
            <DialogDescription>Warehouse code and name are required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Warehouse Code</label>
              <Input value={form.warehouse_code} onChange={(e) => setForm((prev) => ({ ...prev, warehouse_code: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Name</label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select
                className="h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as WarehouseStatus }))}
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
