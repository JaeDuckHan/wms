import { warehousesMock } from "@/features/settings/warehouses/mock";
import type { Warehouse, WarehouseFormInput } from "@/features/settings/warehouses/types";

const LATENCY_MS = 80;
const mockDb: Warehouse[] = warehousesMock.map((item) => ({ ...item }));

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function assertWarehouseCodeUnique(code: string, exceptId?: string) {
  const exists = mockDb.some((item) => normalize(item.warehouse_code) === normalize(code) && item.id !== exceptId);
  if (exists) throw new Error("Warehouse code already exists.");
}

export async function listWarehouses(): Promise<Warehouse[]> {
  await delay(LATENCY_MS);
  return clone(mockDb);
}

export async function createWarehouse(input: WarehouseFormInput): Promise<Warehouse> {
  await delay(LATENCY_MS);
  assertWarehouseCodeUnique(input.warehouse_code);
  const created: Warehouse = {
    id: `wh-${Date.now()}`,
    warehouse_code: input.warehouse_code.trim(),
    name: input.name.trim(),
    status: input.status ?? "active",
    created_at: new Date().toISOString(),
  };
  mockDb.unshift(created);
  return clone(created);
}

export async function updateWarehouse(id: string, input: WarehouseFormInput): Promise<Warehouse> {
  await delay(LATENCY_MS);
  const idx = mockDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Warehouse not found.");
  assertWarehouseCodeUnique(input.warehouse_code, id);
  const updated: Warehouse = {
    ...mockDb[idx],
    warehouse_code: input.warehouse_code.trim(),
    name: input.name.trim(),
    status: input.status ?? mockDb[idx].status,
  };
  mockDb[idx] = updated;
  return clone(updated);
}

export async function toggleWarehouseStatus(id: string): Promise<Warehouse> {
  await delay(LATENCY_MS);
  const idx = mockDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Warehouse not found.");
  const current = mockDb[idx];
  const updated: Warehouse = {
    ...current,
    status: current.status === "active" ? "inactive" : "active",
  };
  mockDb[idx] = updated;
  return clone(updated);
}
