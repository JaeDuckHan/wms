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
import { createClient, listClients, toggleClientStatus, updateClient } from "@/features/settings/clients/api";
import type { Client, ClientStatus } from "@/features/settings/clients/types";

type FormState = {
  client_code: string;
  name: string;
  memo: string;
  status: ClientStatus;
};

const initialForm: FormState = {
  client_code: "",
  name: "",
  memo: "",
  status: "active",
};

export function ClientsSettingsPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);

  const loadRows = async () => {
    const data = await listClients();
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
        item.client_code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setOpen(true);
  };

  const openEdit = (row: Client) => {
    setEditingId(row.id);
    setForm({
      client_code: row.client_code,
      name: row.name,
      memo: row.memo,
      status: row.status,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.client_code.trim() || !form.name.trim()) {
      pushToast({ title: "Missing required fields", description: "Client code and name are required.", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateClient(editingId, form);
        pushToast({ title: "Client updated", variant: "success" });
      } else {
        await createClient(form);
        pushToast({ title: "Client created", variant: "success" });
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

  const toggleStatus = async (row: Client) => {
    await toggleClientStatus(row.id);
    await loadRows();
    pushToast({
      title: row.status === "active" ? "Client deactivated" : "Client reactivated",
      variant: "info",
    });
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }, { label: "Clients" }]}
        title="Clients"
        subtitle="Manage client master data for outbound and inbound operations."
        rightSlot={<Button onClick={openCreate}>New</Button>}
      />
      <SettingsTabs />

      <div className="rounded-xl border bg-white p-6">
        <div className="mb-4">
          <Input
            placeholder="Search by client name or code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <DataTable
          rows={filteredRows}
          emptyText="No clients found."
          rowClassName="cursor-pointer hover:bg-slate-50"
          columns={[
            { key: "client_code", label: "Client Code", render: (row) => <span className="font-medium">{row.client_code}</span> },
            { key: "name", label: "Name", render: (row) => row.name },
            { key: "status", label: "Status", render: (row) => <ActiveStatusBadge status={row.status} /> },
            {
              key: "created_at",
              label: "Created At",
              render: (row) => <span className="tabular-nums text-slate-600">{row.created_at.slice(0, 10)}</span>,
            },
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
            <DialogTitle>{editingId ? "Edit client" : "New client"}</DialogTitle>
            <DialogDescription>Client code and name are required fields.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Client Code</label>
              <Input value={form.client_code} onChange={(e) => setForm((prev) => ({ ...prev, client_code: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Name</label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Memo</label>
              <Input value={form.memo} onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Status</label>
              <select
                className="h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ClientStatus }))}
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
