export type SalesChannelStatus = "active" | "inactive";

export type SalesChannel = {
  id: string;
  name: string;
  status: SalesChannelStatus;
  created_at: string;
};

export type SalesChannelInput = {
  name: string;
  status?: SalesChannelStatus;
};

const STORAGE_KEY = "wms.sales_channels";

const defaultChannels: SalesChannel[] = [
  { id: "manual", name: "manual", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
  { id: "shopee", name: "shopee", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
  { id: "lazada", name: "lazada", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
  { id: "tiktok", name: "tiktok", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
  { id: "offline", name: "offline", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
];

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugify(value: string) {
  return normalizeName(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
}

function cloneRows(rows: SalesChannel[]) {
  return rows.map((row) => ({ ...row }));
}

function readRows() {
  if (typeof window === "undefined") return cloneRows(defaultChannels);
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneRows(defaultChannels);
  try {
    const parsed = JSON.parse(raw) as SalesChannel[];
    if (!Array.isArray(parsed)) return cloneRows(defaultChannels);
    const rows: SalesChannel[] = parsed
      .filter((row) => row && typeof row.name === "string")
      .map((row) => ({
        id: row.id || slugify(row.name),
        name: normalizeName(row.name),
        status: row.status === "inactive" ? ("inactive" as const) : ("active" as const),
        created_at: row.created_at || new Date().toISOString(),
      }));
    return rows;
  } catch {
    return cloneRows(defaultChannels);
  }
}

function writeRows(rows: SalesChannel[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export async function listSalesChannels(): Promise<SalesChannel[]> {
  return readRows();
}

export async function createSalesChannel(input: SalesChannelInput): Promise<SalesChannel> {
  const name = normalizeName(input.name);
  if (!name) throw new Error("Sales channel name is required.");

  const rows = readRows();
  const exists = rows.some((row) => row.name.toLowerCase() === name.toLowerCase());
  if (exists) throw new Error("Sales channel already exists.");

  const created: SalesChannel = {
    id: `${slugify(name)}-${Date.now()}`,
    name,
    status: input.status ?? "active",
    created_at: new Date().toISOString(),
  };
  const next = [created, ...rows];
  writeRows(next);
  return { ...created };
}

export async function toggleSalesChannelStatus(id: string): Promise<SalesChannel> {
  const rows = readRows();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) throw new Error("Sales channel not found.");
  rows[index] = {
    ...rows[index],
    status: rows[index].status === "active" ? "inactive" : "active",
  };
  writeRows(rows);
  return { ...rows[index] };
}

export async function deleteSalesChannel(id: string): Promise<void> {
  const rows = readRows();
  const next = rows.filter((row) => row.id !== id);
  writeRows(next);
}
