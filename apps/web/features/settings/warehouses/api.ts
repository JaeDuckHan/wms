import { warehousesMock } from "@/features/settings/warehouses/mock";
import type {
  Warehouse,
  WarehouseFormInput,
  WarehouseLocation,
  WarehouseLocationFormInput,
  WarehouseLocationQuery,
  WarehouseLocationStatus,
  WarehouseStatus,
} from "@/features/settings/warehouses/types";
import { delay, requestJson, requestVoid, resolveToken, shouldUseFallback, shouldUseMockMode, type RequestOptions } from "@/features/settings/shared/http";

const LATENCY_MS = 80;
const CODE_REGEX = /^[A-Z0-9_-]{2,30}$/;
const mockDb: Warehouse[] = warehousesMock.map((item) => ({ ...item }));
const mockLocationDb: WarehouseLocation[] = warehousesMock.flatMap((warehouse, index) => {
  const seq = index + 1;
  return [
    {
      id: `loc-${seq}-a`,
      warehouse_id: warehouse.id,
      location_code: `LOC-${String(seq).padStart(2, "0")}-A`,
      zone: "A",
      status: "active",
      created_at: warehouse.created_at,
    },
    {
      id: `loc-${seq}-b`,
      warehouse_id: warehouse.id,
      location_code: `LOC-${String(seq).padStart(2, "0")}-B`,
      zone: "B",
      status: seq % 5 === 0 ? "inactive" : "active",
      created_at: warehouse.created_at,
    },
  ];
});

type RawWarehouse = {
  id: number | string;
  warehouse_code?: string | null;
  code?: string | null;
  name?: string | null;
  name_kr?: string | null;
  country?: string | null;
  timezone?: string | null;
  default_cbm_size?: number | string | null;
  default_cbm_rate?: number | string | null;
  status?: string | null;
  created_at?: string | null;
};

type RawWarehouseLocation = {
  id: number | string;
  warehouse_id: number | string;
  location_code?: string | null;
  zone?: string | null;
  status?: string | null;
  created_at?: string | null;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeStatus(value?: string | null): WarehouseStatus {
  return value === "inactive" ? "inactive" : "active";
}

function normalizeLocationStatus(value?: string | null): WarehouseLocationStatus {
  return value === "inactive" ? "inactive" : "active";
}

function validateInput(input: WarehouseFormInput) {
  const warehouse_code = normalizeCode(input.warehouse_code);
  const name = input.name.trim();
  const country = (input.country ?? "KR").trim();
  const timezone = (input.timezone ?? "Asia/Seoul").trim();
  const default_cbm_size = Number(input.default_cbm_size ?? 0.1);
  const default_cbm_rate = Number(input.default_cbm_rate ?? 5000);
  const status = input.status ?? "active";

  if (!warehouse_code) throw new Error("Warehouse code is required.");
  if (!CODE_REGEX.test(warehouse_code)) throw new Error("Warehouse code must be 2-30 chars (A-Z, 0-9, _, -).");
  if (!name) throw new Error("Warehouse name is required.");
  if (name.length > 80) throw new Error("Warehouse name must be 80 characters or less.");
  if (!country) throw new Error("Country is required.");
  if (!timezone) throw new Error("Timezone is required.");
  if (!Number.isFinite(default_cbm_size) || default_cbm_size <= 0) throw new Error("default_cbm_size must be > 0.");
  if (!Number.isFinite(default_cbm_rate) || default_cbm_rate < 0) throw new Error("default_cbm_rate must be >= 0.");

  return { warehouse_code, name, country, timezone, default_cbm_size, default_cbm_rate, status };
}

function validateLocationInput(input: WarehouseLocationFormInput) {
  const warehouse_id = String(input.warehouse_id || "").trim();
  const location_code = normalizeCode(input.location_code);
  const zone = input.zone == null || String(input.zone).trim() === "" ? null : String(input.zone).trim();
  const status = input.status ?? "active";

  if (!warehouse_id) throw new Error("Warehouse is required.");
  if (!location_code) throw new Error("Location code is required.");
  if (location_code.length > 100) throw new Error("Location code must be 100 characters or less.");
  if (zone && zone.length > 100) throw new Error("Zone must be 100 characters or less.");

  return { warehouse_id, location_code, zone, status };
}

function assertWarehouseCodeUnique(code: string, exceptId?: string) {
  const exists = mockDb.some((item) => normalize(item.warehouse_code) === normalize(code) && item.id !== exceptId);
  if (exists) throw new Error("Warehouse code already exists.");
}

function assertLocationCodeUnique(warehouseId: string, code: string, exceptId?: string) {
  const exists = mockLocationDb.some(
    (item) =>
      String(item.warehouse_id) === String(warehouseId) &&
      normalize(item.location_code) === normalize(code) &&
      item.id !== exceptId
  );
  if (exists) throw new Error("Warehouse location code already exists.");
}

function mapRawWarehouse(raw: RawWarehouse): Warehouse {
  const defaultCbmSize = Number(raw.default_cbm_size);
  const defaultCbmRate = Number(raw.default_cbm_rate);
  return {
    id: String(raw.id),
    warehouse_code: normalizeCode(raw.warehouse_code ?? raw.code ?? `WH-${raw.id}`),
    name: (raw.name_kr ?? raw.name ?? "").trim() || `Warehouse #${raw.id}`,
    country: (raw.country ?? "KR").trim() || "KR",
    timezone: (raw.timezone ?? "Asia/Seoul").trim() || "Asia/Seoul",
    default_cbm_size: Number.isFinite(defaultCbmSize) && defaultCbmSize > 0 ? defaultCbmSize : 0.1,
    default_cbm_rate: Number.isFinite(defaultCbmRate) && defaultCbmRate >= 0 ? defaultCbmRate : 5000,
    status: normalizeStatus(raw.status),
    created_at: raw.created_at ?? new Date().toISOString(),
  };
}

function mapRawWarehouseLocation(raw: RawWarehouseLocation): WarehouseLocation {
  return {
    id: String(raw.id),
    warehouse_id: String(raw.warehouse_id),
    location_code: normalizeCode(raw.location_code ?? `LOC-${raw.id}`),
    zone: raw.zone == null || String(raw.zone).trim() === "" ? null : String(raw.zone).trim(),
    status: normalizeLocationStatus(raw.status),
    created_at: raw.created_at ?? new Date().toISOString(),
  };
}

function toLocationSearchParams(query?: WarehouseLocationQuery) {
  const params = new URLSearchParams();
  if (query?.warehouse_id) params.set("warehouse_id", String(query.warehouse_id));
  if (query?.status && query.status !== "all") params.set("status", query.status);
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function listWarehousesFromMock(): Promise<Warehouse[]> {
  await delay(LATENCY_MS);
  return clone(mockDb);
}

async function listWarehouseLocationsFromMock(query?: WarehouseLocationQuery): Promise<WarehouseLocation[]> {
  await delay(LATENCY_MS);
  return clone(
    mockLocationDb.filter(
      (item) =>
        (!query?.warehouse_id || String(item.warehouse_id) === String(query.warehouse_id)) &&
        (!query?.status || query.status === "all" || item.status === query.status)
    )
  );
}

async function createWarehouseInMock(input: WarehouseFormInput): Promise<Warehouse> {
  const validated = validateInput(input);
  assertWarehouseCodeUnique(validated.warehouse_code);
  const created: Warehouse = {
    id: `wh-${Date.now()}`,
    warehouse_code: validated.warehouse_code,
    name: validated.name,
    country: validated.country,
    timezone: validated.timezone,
    default_cbm_size: validated.default_cbm_size,
    default_cbm_rate: validated.default_cbm_rate,
    status: validated.status,
    created_at: new Date().toISOString(),
  };
  mockDb.unshift(created);
  return clone(created);
}

async function createWarehouseLocationInMock(input: WarehouseLocationFormInput): Promise<WarehouseLocation> {
  const validated = validateLocationInput(input);
  const warehouse = mockDb.find((item) => item.id === validated.warehouse_id);
  if (!warehouse) throw new Error("Warehouse not found.");
  assertLocationCodeUnique(validated.warehouse_id, validated.location_code);
  const created: WarehouseLocation = {
    id: `loc-${Date.now()}`,
    warehouse_id: validated.warehouse_id,
    location_code: validated.location_code,
    zone: validated.zone,
    status: validated.status,
    created_at: new Date().toISOString(),
  };
  mockLocationDb.unshift(created);
  return clone(created);
}

async function updateWarehouseInMock(id: string, input: WarehouseFormInput): Promise<Warehouse> {
  const idx = mockDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Warehouse not found.");
  const validated = validateInput(input);
  assertWarehouseCodeUnique(validated.warehouse_code, id);
  const updated: Warehouse = {
    ...mockDb[idx],
    warehouse_code: validated.warehouse_code,
    name: validated.name,
    country: validated.country,
    timezone: validated.timezone,
    default_cbm_size: validated.default_cbm_size,
    default_cbm_rate: validated.default_cbm_rate,
    status: validated.status,
  };
  mockDb[idx] = updated;
  return clone(updated);
}

async function updateWarehouseLocationInMock(id: string, input: WarehouseLocationFormInput): Promise<WarehouseLocation> {
  const idx = mockLocationDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Warehouse location not found.");
  const validated = validateLocationInput(input);
  const warehouse = mockDb.find((item) => item.id === validated.warehouse_id);
  if (!warehouse) throw new Error("Warehouse not found.");
  assertLocationCodeUnique(validated.warehouse_id, validated.location_code, id);
  const updated: WarehouseLocation = {
    ...mockLocationDb[idx],
    warehouse_id: validated.warehouse_id,
    location_code: validated.location_code,
    zone: validated.zone,
    status: validated.status,
  };
  mockLocationDb[idx] = updated;
  return clone(updated);
}

async function toggleWarehouseStatusInMock(id: string): Promise<Warehouse> {
  const idx = mockDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Warehouse not found.");
  const current = mockDb[idx];
  const updated: Warehouse = { ...current, status: current.status === "active" ? "inactive" : "active" };
  mockDb[idx] = updated;
  return clone(updated);
}

async function deleteWarehouseInMock(id: string): Promise<void> {
  const idx = mockDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Warehouse not found.");
  mockDb.splice(idx, 1);
}

async function deleteWarehouseLocationInMock(id: string): Promise<void> {
  const idx = mockLocationDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Warehouse location not found.");
  mockLocationDb.splice(idx, 1);
}

export async function listWarehouses(options?: RequestOptions): Promise<Warehouse[]> {
  const token = await resolveToken(options?.token);
  if (shouldUseMockMode()) return listWarehousesFromMock();

  try {
    const rows = await requestJson<RawWarehouse[]>("/warehouses", undefined, options);
    const mapped = rows.map(mapRawWarehouse);
    if (mapped.length === 0 && shouldUseFallback(token)) return listWarehousesFromMock();
    return mapped;
  } catch (error) {
    if (shouldUseFallback(token)) return listWarehousesFromMock();
    throw error;
  }
}

export async function listWarehouseLocations(
  query?: WarehouseLocationQuery,
  options?: RequestOptions
): Promise<WarehouseLocation[]> {
  const token = await resolveToken(options?.token);
  if (shouldUseMockMode()) return listWarehouseLocationsFromMock(query);

  try {
    const rows = await requestJson<RawWarehouseLocation[]>(`/warehouse-locations${toLocationSearchParams(query)}`, undefined, options);
    const mapped = rows.map(mapRawWarehouseLocation);
    if (mapped.length === 0 && shouldUseFallback(token)) return listWarehouseLocationsFromMock(query);
    return mapped;
  } catch (error) {
    if (shouldUseFallback(token)) return listWarehouseLocationsFromMock(query);
    throw error;
  }
}

export async function createWarehouse(input: WarehouseFormInput, options?: RequestOptions): Promise<Warehouse> {
  const token = await resolveToken(options?.token);
  if (shouldUseMockMode()) return createWarehouseInMock(input);

  const validated = validateInput(input);
  try {
    const created = await requestJson<RawWarehouse>(
      "/warehouses",
      {
        method: "POST",
        body: JSON.stringify({
          warehouse_code: validated.warehouse_code,
          code: validated.warehouse_code,
          name: validated.name,
          name_kr: validated.name,
          country: validated.country,
          timezone: validated.timezone,
          default_cbm_size: validated.default_cbm_size,
          default_cbm_rate: validated.default_cbm_rate,
          status: validated.status,
        }),
      },
      options
    );
    return mapRawWarehouse(created);
  } catch (error) {
    if (shouldUseFallback(token)) return createWarehouseInMock(validated);
    throw error;
  }
}

export async function createWarehouseLocation(
  input: WarehouseLocationFormInput,
  options?: RequestOptions
): Promise<WarehouseLocation> {
  const token = await resolveToken(options?.token);
  if (shouldUseMockMode()) return createWarehouseLocationInMock(input);

  const validated = validateLocationInput(input);
  try {
    const created = await requestJson<RawWarehouseLocation>(
      "/warehouse-locations",
      {
        method: "POST",
        body: JSON.stringify(validated),
      },
      options
    );
    return mapRawWarehouseLocation(created);
  } catch (error) {
    if (shouldUseFallback(token)) return createWarehouseLocationInMock(validated);
    throw error;
  }
}

export async function updateWarehouse(id: string, input: WarehouseFormInput, options?: RequestOptions): Promise<Warehouse> {
  const token = await resolveToken(options?.token);
  if (shouldUseMockMode()) return updateWarehouseInMock(id, input);

  const validated = validateInput(input);
  try {
    const updated = await requestJson<RawWarehouse>(
      `/warehouses/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          warehouse_code: validated.warehouse_code,
          code: validated.warehouse_code,
          name: validated.name,
          name_kr: validated.name,
          country: validated.country,
          timezone: validated.timezone,
          default_cbm_size: validated.default_cbm_size,
          default_cbm_rate: validated.default_cbm_rate,
          status: validated.status,
        }),
      },
      options
    );
    return mapRawWarehouse(updated);
  } catch (error) {
    if (shouldUseFallback(token)) return updateWarehouseInMock(id, validated);
    throw error;
  }
}

export async function updateWarehouseLocation(
  id: string,
  input: WarehouseLocationFormInput,
  options?: RequestOptions
): Promise<WarehouseLocation> {
  const token = await resolveToken(options?.token);
  if (shouldUseMockMode()) return updateWarehouseLocationInMock(id, input);

  const validated = validateLocationInput(input);
  try {
    const updated = await requestJson<RawWarehouseLocation>(
      `/warehouse-locations/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(validated),
      },
      options
    );
    return mapRawWarehouseLocation(updated);
  } catch (error) {
    if (shouldUseFallback(token)) return updateWarehouseLocationInMock(id, validated);
    throw error;
  }
}

export async function toggleWarehouseStatus(id: string, options?: RequestOptions): Promise<Warehouse> {
  const token = await resolveToken(options?.token);
  if (shouldUseMockMode()) return toggleWarehouseStatusInMock(id);

  try {
    const current = await requestJson<RawWarehouse>(`/warehouses/${id}`, undefined, options);
    const nextStatus: WarehouseStatus = normalizeStatus(current.status) === "active" ? "inactive" : "active";
    const updated = await requestJson<RawWarehouse>(
      `/warehouses/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          status: nextStatus,
          warehouse_code: current.warehouse_code ?? current.code,
          code: current.warehouse_code ?? current.code,
          name: current.name ?? current.name_kr,
          name_kr: current.name_kr ?? current.name,
          country: current.country ?? "KR",
          timezone: current.timezone ?? "Asia/Seoul",
          default_cbm_size: current.default_cbm_size ?? 0.1,
          default_cbm_rate: current.default_cbm_rate ?? 5000,
        }),
      },
      options
    );
    return mapRawWarehouse(updated);
  } catch (error) {
    if (shouldUseFallback(token)) return toggleWarehouseStatusInMock(id);
    throw error;
  }
}

export async function deleteWarehouse(id: string, options?: RequestOptions): Promise<void> {
  const token = await resolveToken(options?.token);
  if (shouldUseMockMode()) return deleteWarehouseInMock(id);

  try {
    await requestVoid(`/warehouses/${id}`, { method: "DELETE" }, options);
  } catch (error) {
    if (shouldUseFallback(token)) return deleteWarehouseInMock(id);
    throw error;
  }
}

export async function deleteWarehouseLocation(id: string, options?: RequestOptions): Promise<void> {
  const token = await resolveToken(options?.token);
  if (shouldUseMockMode()) return deleteWarehouseLocationInMock(id);

  try {
    await requestVoid(`/warehouse-locations/${id}`, { method: "DELETE" }, options);
  } catch (error) {
    if (shouldUseFallback(token)) return deleteWarehouseLocationInMock(id);
    throw error;
  }
}
