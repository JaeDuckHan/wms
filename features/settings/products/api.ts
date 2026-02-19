import { productsMock } from "@/features/settings/products/mock";
import type { Product, ProductFormInput } from "@/features/settings/products/types";

const LATENCY_MS = 80;
const mockDb: Product[] = productsMock.map((item) => ({ ...item }));

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function buildBarcodeFull(clientCode: string, barcodeRaw: string) {
  return `${clientCode.trim()}-${barcodeRaw.trim()}`;
}

function assertUnique(clientCode: string, barcodeRaw: string, exceptId?: string) {
  const cc = normalize(clientCode);
  const br = normalize(barcodeRaw);
  const exists = mockDb.some(
    (item) => normalize(item.client_code) === cc && normalize(item.barcode_raw) === br && item.id !== exceptId
  );
  if (exists) throw new Error("Product already exists for this client code and barcode.");
}

export async function listProducts(): Promise<Product[]> {
  await delay(LATENCY_MS);
  return clone(mockDb);
}

export async function createProduct(input: ProductFormInput): Promise<Product> {
  await delay(LATENCY_MS);
  assertUnique(input.client_code, input.barcode_raw);
  const created: Product = {
    id: `prd-${Date.now()}`,
    client_code: input.client_code.trim(),
    barcode_raw: input.barcode_raw.trim(),
    barcode_full: buildBarcodeFull(input.client_code, input.barcode_raw),
    name: input.name.trim(),
    status: input.status ?? "active",
    created_at: new Date().toISOString(),
  };
  mockDb.unshift(created);
  return clone(created);
}

export async function updateProduct(id: string, input: ProductFormInput): Promise<Product> {
  await delay(LATENCY_MS);
  const idx = mockDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Product not found.");
  assertUnique(input.client_code, input.barcode_raw, id);
  const updated: Product = {
    ...mockDb[idx],
    client_code: input.client_code.trim(),
    barcode_raw: input.barcode_raw.trim(),
    barcode_full: buildBarcodeFull(input.client_code, input.barcode_raw),
    name: input.name.trim(),
    status: input.status ?? mockDb[idx].status,
  };
  mockDb[idx] = updated;
  return clone(updated);
}

export async function toggleProductStatus(id: string): Promise<Product> {
  await delay(LATENCY_MS);
  const idx = mockDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Product not found.");
  const current = mockDb[idx];
  const updated: Product = {
    ...current,
    status: current.status === "active" ? "inactive" : "active",
  };
  mockDb[idx] = updated;
  return clone(updated);
}
