"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActiveStatusBadge } from "@/components/ui/ActiveStatusBadge";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import {
  createSalesChannel,
  deleteSalesChannel,
  listSalesChannels,
  toggleSalesChannelStatus,
  type SalesChannel,
} from "@/features/settings/sales-channels/api";

export function SalesChannelsSettingsPage() {
  const { pushToast } = useToast();
  const { canAccessSettings, canWrite, ready } = useCurrentUser();
  const [rows, setRows] = useState<SalesChannel[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listSalesChannels());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load sales channels.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !canAccessSettings) return;
    void loadRows();
  }, [ready, canAccessSettings]);

  const addRow = async () => {
    setError(null);
    try {
      await createSalesChannel({ name });
      setName("");
      await loadRows();
      pushToast({ title: "Sales channel saved", variant: "success" });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Save failed";
      setError(message);
      pushToast({ title: "Save failed", description: message, variant: "error" });
    }
  };

  const toggleRow = async (row: SalesChannel) => {
    await toggleSalesChannelStatus(row.id);
    await loadRows();
  };

  const removeRow = async (row: SalesChannel) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    await deleteSalesChannel(row.id);
    await loadRows();
  };

  const accessDenied = ready && !canAccessSettings;

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }, { label: "Sales Channels" }]}
        title="Sales Channels"
        subtitle="Preset outbound sales channels used when creating and editing outbound orders."
      />
      <SettingsTabs />

      {accessDenied ? (
        <div className="rounded-xl border bg-white p-6">
          <ErrorState title="Access denied" message="Customer accounts cannot access settings." />
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-6">
          {!canWrite ? (
            <div className="mb-4 text-xs text-amber-700">Read-only role: sales channel write actions are disabled.</div>
          ) : null}
          <div className="mb-4 flex flex-col gap-2 md:flex-row">
            <Input
              placeholder="e.g. shopee"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canWrite}
            />
            <Button onClick={() => void addRow()} disabled={!canWrite || !name.trim()}>
              Add
            </Button>
          </div>
          {error ? <div className="mb-4"><ErrorState title="Action failed" message={error} /></div> : null}
          <DataTable
            rows={rows}
            emptyText={loading ? "Loading sales channels..." : "No sales channels found."}
            columns={[
              { key: "name", label: "Sales Channel", render: (row) => row.name },
              { key: "status", label: "Status", render: (row) => <ActiveStatusBadge status={row.status} /> },
              {
                key: "actions",
                label: "Actions",
                render: (row) =>
                  canWrite ? (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => void toggleRow(row)}>
                        {row.status === "active" ? "Archive" : "Activate"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void removeRow(row)}>
                        Delete
                      </Button>
                    </div>
                  ) : null,
              },
            ]}
          />
        </div>
      )}
    </section>
  );
}
