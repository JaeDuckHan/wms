import { requestJson, shouldUseMockMode, type RequestOptions } from "@/features/settings/shared/http";

export type WarehouseLocationOption = {
  id: string;
  warehouse_id: number;
  location_code: string;
  zone: string | null;
  status: "active" | "inactive" | string;
};

type RawWarehouseLocation = {
  id: number | string;
  warehouse_id: number | string;
  location_code?: string | null;
  zone?: string | null;
  status?: string | null;
};

export type WarehouseLocationQuery = {
  warehouse_id?: string | number | null;
  status?: string | null;
};

function mapRawWarehouseLocation(raw: RawWarehouseLocation): WarehouseLocationOption {
  return {
    id: String(raw.id),
    warehouse_id: Number(raw.warehouse_id),
    location_code: raw.location_code?.trim() || `LOC-${raw.id}`,
    zone: raw.zone ?? null,
    status: raw.status ?? "active",
  };
}

function toSearchParams(query?: WarehouseLocationQuery) {
  const params = new URLSearchParams();
  if (query?.warehouse_id) params.set("warehouse_id", String(query.warehouse_id));
  if (query?.status) params.set("status", query.status);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export async function listWarehouseLocations(
  query?: WarehouseLocationQuery,
  options?: RequestOptions
): Promise<WarehouseLocationOption[]> {
  if (shouldUseMockMode()) return [];
  const rows = await requestJson<RawWarehouseLocation[]>(`/warehouse-locations${toSearchParams(query)}`, undefined, options);
  return rows.map(mapRawWarehouseLocation);
}
