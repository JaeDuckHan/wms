"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/DataTable";
import { ActiveStatusBadge } from "@/components/ui/ActiveStatusBadge";
import { Badge } from "@/components/ui/badge";
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
import { ErrorState } from "@/components/ui/ErrorState";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import {
  createWarehouse,
  createWarehouseLocation,
  deleteWarehouse,
  deleteWarehouseLocation,
  listWarehouseLocations,
  listWarehouses,
  toggleWarehouseStatus,
  updateWarehouse,
  updateWarehouseLocation,
} from "@/features/settings/warehouses/api";
import type {
  Warehouse,
  WarehouseLocation,
  WarehouseLocationStatus,
  WarehouseStatus,
} from "@/features/settings/warehouses/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
type FormState = {
  warehouse_code: string;
  name: string;
  country: string;
  timezone: string;
  default_cbm_size: string;
  default_cbm_rate: string;
  status: WarehouseStatus;
};

type LocationFormState = {
  location_code: string;
  zone: string;
  status: WarehouseLocationStatus;
};

type StatusFilter = "all" | WarehouseStatus;
type LocationStatusFilter = "all" | WarehouseLocationStatus;
type SortKey = "created_desc" | "created_asc" | "code_asc" | "name_asc";

const initialForm: FormState = {
  warehouse_code: "",
  name: "",
  country: "KR",
  timezone: "Asia/Seoul",
  default_cbm_size: "0.1",
  default_cbm_rate: "5000",
  status: "active",
};

const initialLocationForm: LocationFormState = {
  location_code: "",
  zone: "",
  status: "active",
};

export function WarehousesSettingsPage() {
  const { pushToast } = useToast();
  const { t } = useI18n();
  const { canAccessSettings, canWrite, ready } = useCurrentUser();
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_desc");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [locationRows, setLocationRows] = useState<WarehouseLocation[]>([]);
  const [locationLoadError, setLocationLoadError] = useState<string | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationStatusFilter, setLocationStatusFilter] = useState<LocationStatusFilter>("all");
  const [locationOpen, setLocationOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState<LocationFormState>(initialLocationForm);
  const [locationFieldError, setLocationFieldError] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [togglingLocationId, setTogglingLocationId] = useState<string | null>(null);
  const [removingLocationId, setRemovingLocationId] = useState<string | null>(null);

  const loadRows = async () => {
    setLoadingRows(true);
    setLoadError(null);
    try {
      const data = await listWarehouses();
      setRows(data);
      setSelectedWarehouseId((current) => (current && data.some((item) => item.id === current) ? current : data[0]?.id ?? null));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t("Failed to load warehouses."));
    } finally {
      setLoadingRows(false);
    }
  };

  const selectedWarehouse = useMemo(() => {
    return rows.find((item) => item.id === selectedWarehouseId) ?? rows[0] ?? null;
  }, [rows, selectedWarehouseId]);

  const loadLocations = async (warehouseId?: string | null) => {
    const targetWarehouseId = warehouseId ?? selectedWarehouse?.id ?? null;
    if (!targetWarehouseId) {
      setLocationRows([]);
      return;
    }

    setLoadingLocations(true);
    setLocationLoadError(null);
    try {
      const data = await listWarehouseLocations({ warehouse_id: targetWarehouseId });
      setLocationRows(data);
    } catch (error) {
      setLocationLoadError(error instanceof Error ? error.message : "Failed to load locations.");
    } finally {
      setLoadingLocations(false);
    }
  };

  useEffect(() => {
    if (!ready || !canAccessSettings) return;
    void loadRows();
  }, [ready, canAccessSettings]);

  useEffect(() => {
    if (!ready || !canAccessSettings) return;
    void loadLocations(selectedWarehouse?.id);
  }, [ready, canAccessSettings, selectedWarehouse?.id]);

  const accessDenied = ready && !canAccessSettings;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = rows.filter(
      (item) =>
        (statusFilter === "all" || item.status === statusFilter) &&
        (
        item.warehouse_code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
        )
    );
    const sorted = [...searched];
    sorted.sort((a, b) => {
      if (sortKey === "created_desc") return b.created_at.localeCompare(a.created_at);
      if (sortKey === "created_asc") return a.created_at.localeCompare(b.created_at);
      if (sortKey === "code_asc") return a.warehouse_code.localeCompare(b.warehouse_code);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [rows, search, statusFilter, sortKey]);

  const counts = useMemo(() => {
    const active = rows.filter((item) => item.status === "active").length;
    return {
      total: rows.length,
      active,
      inactive: rows.length - active,
      filtered: filteredRows.length,
    };
  }, [rows, filteredRows]);

  const filteredLocationRows = useMemo(() => {
    const q = locationSearch.trim().toLowerCase();
    return locationRows.filter(
      (item) =>
        (locationStatusFilter === "all" || item.status === locationStatusFilter) &&
        (item.location_code.toLowerCase().includes(q) || (item.zone ?? "").toLowerCase().includes(q))
    );
  }, [locationRows, locationSearch, locationStatusFilter]);

  const locationCounts = useMemo(() => {
    const active = locationRows.filter((item) => item.status === "active").length;
    return {
      total: locationRows.length,
      active,
      inactive: locationRows.length - active,
      filtered: filteredLocationRows.length,
    };
  }, [locationRows, filteredLocationRows]);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setFieldError(null);
    setOpen(true);
  };

  const openEdit = (row: Warehouse) => {
    setEditingId(row.id);
    setForm({
      warehouse_code: row.warehouse_code,
      name: row.name,
      country: row.country,
      timezone: row.timezone,
      default_cbm_size: String(row.default_cbm_size),
      default_cbm_rate: String(row.default_cbm_rate),
      status: row.status,
    });
    setFieldError(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!form.warehouse_code.trim() || !form.name.trim()) {
      setFieldError(t("Warehouse code and name are required."));
      pushToast({
        title: t("Missing required fields"),
        description: t("Warehouse code and name are required."),
        variant: "error",
      });
      return;
    }

    setFieldError(null);
    setSaving(true);
    try {
      if (editingId) {
        await updateWarehouse(editingId, {
          warehouse_code: form.warehouse_code,
          name: form.name,
          country: form.country,
          timezone: form.timezone,
          default_cbm_size: Number(form.default_cbm_size || 0),
          default_cbm_rate: Number(form.default_cbm_rate || 0),
          status: form.status,
        });
        pushToast({ title: t("Warehouse updated"), variant: "success" });
      } else {
        await createWarehouse({
          warehouse_code: form.warehouse_code,
          name: form.name,
          country: form.country,
          timezone: form.timezone,
          default_cbm_size: Number(form.default_cbm_size || 0),
          default_cbm_rate: Number(form.default_cbm_rate || 0),
          status: form.status,
        });
        pushToast({ title: t("Warehouse created"), variant: "success" });
      }
      await loadRows();
      setOpen(false);
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : t("Please try again."));
      pushToast({
        title: t("Save failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: Warehouse) => {
    setTogglingId(row.id);
    try {
      await toggleWarehouseStatus(row.id);
      await loadRows();
      pushToast({
        title: row.status === "active" ? t("Warehouse deactivated") : t("Warehouse reactivated"),
        variant: "info",
      });
    } catch (error) {
      pushToast({
        title: t("Action failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "error",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const removeRow = async (row: Warehouse) => {
    if (!window.confirm(`${t("Delete")} ${row.warehouse_code}?`)) return;
    setRemovingId(row.id);
    try {
      await deleteWarehouse(row.id);
      await loadRows();
      if (editingId === row.id) {
        setOpen(false);
        setEditingId(null);
        setForm(initialForm);
      }
      pushToast({ title: t("Deleted"), variant: "info" });
    } catch (error) {
      pushToast({
        title: t("Delete failed"),
        description: error instanceof Error ? error.message : t("Please try again."),
        variant: "error",
      });
    } finally {
      setRemovingId(null);
    }
  };

  const openCreateLocation = () => {
    if (!selectedWarehouse) {
      setLocationFieldError("Select a warehouse first.");
      pushToast({ title: "Select a warehouse first.", variant: "error" });
      return;
    }
    setEditingLocationId(null);
    setLocationForm(initialLocationForm);
    setLocationFieldError(null);
    setLocationOpen(true);
  };

  const openEditLocation = (row: WarehouseLocation) => {
    setEditingLocationId(row.id);
    setLocationForm({
      location_code: row.location_code,
      zone: row.zone ?? "",
      status: row.status,
    });
    setLocationFieldError(null);
    setLocationOpen(true);
  };

  const submitLocation = async () => {
    if (!selectedWarehouse) {
      setLocationFieldError("Select a warehouse first.");
      return;
    }
    if (!locationForm.location_code.trim()) {
      setLocationFieldError("Location code is required.");
      pushToast({ title: "Missing required fields", description: "Location code is required.", variant: "error" });
      return;
    }

    setLocationFieldError(null);
    setSavingLocation(true);
    try {
      const payload = {
        warehouse_id: selectedWarehouse.id,
        location_code: locationForm.location_code,
        zone: locationForm.zone,
        status: locationForm.status,
      };
      if (editingLocationId) {
        await updateWarehouseLocation(editingLocationId, payload);
        pushToast({ title: "Location updated", variant: "success" });
      } else {
        await createWarehouseLocation(payload);
        pushToast({ title: "Location created", variant: "success" });
      }
      await loadLocations(selectedWarehouse.id);
      setLocationOpen(false);
    } catch (error) {
      setLocationFieldError(error instanceof Error ? error.message : "Please try again.");
      pushToast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSavingLocation(false);
    }
  };

  const toggleLocationStatus = async (row: WarehouseLocation) => {
    if (!selectedWarehouse) return;
    setTogglingLocationId(row.id);
    try {
      await updateWarehouseLocation(row.id, {
        warehouse_id: row.warehouse_id,
        location_code: row.location_code,
        zone: row.zone,
        status: row.status === "active" ? "inactive" : "active",
      });
      await loadLocations(selectedWarehouse.id);
      pushToast({ title: row.status === "active" ? "Location deactivated" : "Location reactivated", variant: "info" });
    } catch (error) {
      pushToast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setTogglingLocationId(null);
    }
  };

  const removeLocation = async (row: WarehouseLocation) => {
    if (!selectedWarehouse) return;
    if (!window.confirm(`${t("Delete")} ${row.location_code}?`)) return;
    setRemovingLocationId(row.id);
    try {
      await deleteWarehouseLocation(row.id);
      await loadLocations(selectedWarehouse.id);
      if (editingLocationId === row.id) {
        setLocationOpen(false);
        setEditingLocationId(null);
        setLocationForm(initialLocationForm);
      }
      pushToast({ title: "Location deleted", variant: "info" });
    } catch (error) {
      pushToast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setRemovingLocationId(null);
    }
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }, { label: "Warehouses" }]}
        title="Warehouses"
        subtitle="Configure warehouse master records used across operations."
        rightSlot={canWrite ? <Button onClick={openCreate}>{t("New")}</Button> : undefined}
      />
      <SettingsTabs />
      {accessDenied ? (
        <div className="rounded-xl border bg-white p-6">
          <ErrorState title={t("Access denied")} message={t("Customer accounts cannot access settings.")} />
        </div>
      ) : null}
      {accessDenied ? null : (
        <>
      <div className="rounded-xl border bg-white p-6">
        {!canWrite ? <div className="mb-4 text-xs text-amber-700">Read-only role: warehouse write actions are disabled.</div> : null}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="default">{`${t("All")}: ${counts.total}`}</Badge>
          <Badge variant="success">{`${t("Active")}: ${counts.active}`}</Badge>
          <Badge variant="warning">{`${t("Inactive")}: ${counts.inactive}`}</Badge>
          <Badge variant="info">{`${t("Filter")}: ${counts.filtered}`}</Badge>
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Input
            placeholder="Search by warehouse name or code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">{t("All Status")}</option>
            <option value="active">{t("Active")}</option>
            <option value="inactive">{t("Inactive")}</option>
          </select>
          <select
            className="h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="created_desc">{t("Newest")}</option>
            <option value="created_asc">{t("Oldest")}</option>
            <option value="code_asc">{t("Warehouse Code")}</option>
            <option value="name_asc">{t("Name")}</option>
          </select>
        </div>

        {loadError ? (
          <ErrorState title={t("Failed to load warehouses.")} message={loadError} onRetry={() => void loadRows()} />
        ) : (
          <DataTable
            rows={filteredRows}
            emptyText={loadingRows ? t("Loading warehouses...") : t("No warehouses found.")}
            rowClassName="cursor-pointer hover:bg-slate-50"
            columns={[
            { key: "warehouse_code", label: "Warehouse Code", render: (row) => <span className="font-medium">{row.warehouse_code}</span> },
            { key: "name", label: "Name", render: (row) => row.name },
            { key: "default_cbm_size", label: "Default CBM", render: (row) => Number(row.default_cbm_size).toFixed(4) },
            { key: "default_cbm_rate", label: "Default Price", render: (row) => Number(row.default_cbm_rate).toLocaleString() },
            { key: "status", label: "Status", render: (row) => <ActiveStatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={selectedWarehouse?.id === row.id ? "default" : "secondary"} onClick={() => setSelectedWarehouseId(row.id)}>
                    Locations
                  </Button>
                  {canWrite ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => openEdit(row)} disabled={togglingId === row.id || removingId === row.id}>{t("Edit")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => void toggleStatus(row)} disabled={togglingId === row.id || removingId === row.id}>
                        {row.status === "active" ? t("Deactivate") : t("Activate")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void removeRow(row)} disabled={togglingId === row.id || removingId === row.id}>
                        {t("Delete")}
                      </Button>
                    </>
                  ) : null}
                </div>
              ),
            },
          ]}
          />
        )}
      </div>

      <div className="mt-6 rounded-xl border bg-white p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Location management</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedWarehouse
                ? `${selectedWarehouse.warehouse_code} - ${selectedWarehouse.name}`
                : "Create or select a warehouse before adding locations."}
            </p>
          </div>
          {canWrite ? (
            <Button onClick={openCreateLocation} disabled={!selectedWarehouse}>
              New Location
            </Button>
          ) : null}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="default">{`${t("All")}: ${locationCounts.total}`}</Badge>
          <Badge variant="success">{`${t("Active")}: ${locationCounts.active}`}</Badge>
          <Badge variant="warning">{`${t("Inactive")}: ${locationCounts.inactive}`}</Badge>
          <Badge variant="info">{`${t("Filter")}: ${locationCounts.filtered}`}</Badge>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <select
            className="h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            value={selectedWarehouse?.id ?? ""}
            onChange={(event) => setSelectedWarehouseId(event.target.value || null)}
          >
            {rows.length === 0 ? <option value="">No warehouses</option> : null}
            {rows.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.warehouse_code} - {warehouse.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Search by location code or zone"
            value={locationSearch}
            onChange={(event) => setLocationSearch(event.target.value)}
          />
          <select
            className="h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
            value={locationStatusFilter}
            onChange={(event) => setLocationStatusFilter(event.target.value as LocationStatusFilter)}
          >
            <option value="all">{t("All Status")}</option>
            <option value="active">{t("Active")}</option>
            <option value="inactive">{t("Inactive")}</option>
          </select>
        </div>

        {locationLoadError ? (
          <ErrorState title="Failed to load locations." message={locationLoadError} onRetry={() => void loadLocations(selectedWarehouse?.id)} />
        ) : (
          <DataTable
            rows={filteredLocationRows}
            emptyText={loadingLocations ? "Loading locations..." : "No locations found."}
            columns={[
              { key: "location_code", label: "Location Code", render: (row) => <span className="font-medium">{row.location_code}</span> },
              { key: "zone", label: "Zone", render: (row) => row.zone || "-" },
              { key: "status", label: "Status", render: (row) => <ActiveStatusBadge status={row.status} /> },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex items-center gap-2">
                    {canWrite ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEditLocation(row)}
                          disabled={togglingLocationId === row.id || removingLocationId === row.id}
                        >
                          {t("Edit")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void toggleLocationStatus(row)}
                          disabled={togglingLocationId === row.id || removingLocationId === row.id}
                        >
                          {row.status === "active" ? t("Deactivate") : t("Activate")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void removeLocation(row)}
                          disabled={togglingLocationId === row.id || removingLocationId === row.id}
                        >
                          {t("Delete")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t("Edit warehouse") : t("New warehouse")}</DialogTitle>
            <DialogDescription>{t("Warehouse code and name are required.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("Warehouse Code")}</label>
              <Input
                value={form.warehouse_code}
                onChange={(e) => setForm((prev) => ({ ...prev, warehouse_code: e.target.value.toUpperCase() }))}
                placeholder="e.g. ICN-01"
              />
              <p className="text-xs text-slate-500">{t("Use 2-30 chars: A-Z, 0-9, underscore or hyphen.")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("Name")}</label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Default CBM size</label>
              <Input
                type="number"
                step="0.0001"
                min="0.0001"
                value={form.default_cbm_size}
                onChange={(e) => setForm((prev) => ({ ...prev, default_cbm_size: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Default CBM price</label>
              <Input
                type="number"
                step="1"
                min="0"
                value={form.default_cbm_rate}
                onChange={(e) => setForm((prev) => ({ ...prev, default_cbm_rate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("Status")}</label>
              <select
                className="h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as WarehouseStatus }))}
              >
                <option value="active">{t("Active")}</option>
                <option value="inactive">{t("Inactive")}</option>
              </select>
            </div>
            {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={() => void submit()} disabled={!canWrite || saving || !form.warehouse_code.trim() || !form.name.trim()}>
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={locationOpen} onOpenChange={setLocationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocationId ? "Edit location" : "New location"}</DialogTitle>
            <DialogDescription>
              {selectedWarehouse
                ? `${selectedWarehouse.warehouse_code} - ${selectedWarehouse.name}`
                : "Select a warehouse first."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Location Code</label>
              <Input
                value={locationForm.location_code}
                onChange={(event) => setLocationForm((prev) => ({ ...prev, location_code: event.target.value.toUpperCase() }))}
                placeholder="e.g. A-01-03"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Zone</label>
              <Input
                value={locationForm.zone}
                onChange={(event) => setLocationForm((prev) => ({ ...prev, zone: event.target.value }))}
                placeholder="e.g. A"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("Status")}</label>
              <select
                className="h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                value={locationForm.status}
                onChange={(event) => setLocationForm((prev) => ({ ...prev, status: event.target.value as WarehouseLocationStatus }))}
              >
                <option value="active">{t("Active")}</option>
                <option value="inactive">{t("Inactive")}</option>
              </select>
            </div>
            {locationFieldError ? <p className="text-xs text-red-600">{locationFieldError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setLocationOpen(false)}>{t("Cancel")}</Button>
            <Button
              onClick={() => void submitLocation()}
              disabled={!canWrite || !selectedWarehouse || savingLocation || !locationForm.location_code.trim()}
            >
              {savingLocation ? t("Saving...") : t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}
    </section>
  );
}


