import { clientsMock } from "@/features/settings/clients/mock";
import type { Client, ClientFormInput } from "@/features/settings/clients/types";

const LATENCY_MS = 80;
const mockDb: Client[] = clientsMock.map((item) => ({ ...item }));

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function assertClientCodeUnique(clientCode: string, exceptId?: string) {
  const exists = mockDb.some((item) => normalize(item.client_code) === normalize(clientCode) && item.id !== exceptId);
  if (exists) throw new Error("Client code already exists.");
}

export async function listClients(): Promise<Client[]> {
  await delay(LATENCY_MS);
  return clone(mockDb);
}

export async function createClient(input: ClientFormInput): Promise<Client> {
  await delay(LATENCY_MS);
  assertClientCodeUnique(input.client_code);
  const now = new Date().toISOString();
  const created: Client = {
    id: `cl-${Date.now()}`,
    client_code: input.client_code.trim(),
    name: input.name.trim(),
    memo: input.memo?.trim() ?? "",
    status: input.status ?? "active",
    created_at: now,
  };
  mockDb.unshift(created);
  return clone(created);
}

export async function updateClient(id: string, input: ClientFormInput): Promise<Client> {
  await delay(LATENCY_MS);
  const idx = mockDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Client not found.");
  assertClientCodeUnique(input.client_code, id);
  const updated: Client = {
    ...mockDb[idx],
    client_code: input.client_code.trim(),
    name: input.name.trim(),
    memo: input.memo?.trim() ?? "",
    status: input.status ?? mockDb[idx].status,
  };
  mockDb[idx] = updated;
  return clone(updated);
}

export async function toggleClientStatus(id: string): Promise<Client> {
  await delay(LATENCY_MS);
  const idx = mockDb.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("Client not found.");
  const current = mockDb[idx];
  const updated: Client = {
    ...current,
    status: current.status === "active" ? "inactive" : "active",
  };
  mockDb[idx] = updated;
  return clone(updated);
}
