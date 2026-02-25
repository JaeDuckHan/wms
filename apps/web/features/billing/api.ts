import {
  requestJson,
  resolveToken,
  shouldUseFallback,
  shouldUseMockMode,
  type RequestOptions,
} from "@/features/settings/shared/http";

export type ServiceRate = {
  id: number;
  service_code: string;
  service_name: string;
  billing_unit: "ORDER" | "SKU" | "BOX" | "CBM" | "PALLET" | "EVENT" | "MONTH";
  pricing_policy: "THB_BASED" | "KRW_FIXED";
  default_currency: "THB" | "KRW";
  default_rate: number;
  status: "active" | "inactive";
};

export type ClientContractRate = {
  id: number;
  client_id: number;
  service_code: string;
  custom_rate: number;
  currency: "THB" | "KRW";
  effective_date: string;
};

export type ExchangeRate = {
  id: number;
  rate_date: string;
  base_currency: "THB";
  quote_currency: "KRW";
  rate: number;
  source: "manual" | "api";
  locked: number;
  status: "draft" | "active" | "superseded";
  used_invoice_count?: number;
};

export type BillingInvoice = {
  id: number;
  client_id: number;
  client_code: string;
  name_kr: string;
  invoice_no: string;
  invoice_month: string;
  invoice_date: string;
  currency: "KRW";
  fx_rate_thbkrw: number;
  subtotal_krw: number;
  vat_krw: number;
  total_krw: number;
  status: string;
};

export type BillingInvoiceItem = {
  id: number;
  invoice_id: number;
  service_code: string;
  description: string;
  qty: number;
  unit_price_krw: number;
  amount_krw: number;
  unit_price_trunc100?: number;
  amount_trunc100?: number;
};

export type BillingEvent = {
  id: number;
  event_date: string;
  client_id: number;
  client_code: string;
  name_kr: string;
  service_code: string;
  qty: number;
  amount_thb: number | null;
  fx_rate_thbkrw: number | null;
  amount_krw: number | null;
  reference_type: string;
  reference_id: string | null;
  status: "PENDING" | "INVOICED";
  invoice_id: number | null;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function pad4(value: number) {
  return String(value).padStart(4, "0");
}

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function trunc100(value: number) {
  return Math.trunc(value / 100) * 100;
}

let nextServiceRateId = 21;
let nextContractRateId = 21;
let nextExchangeRateId = 21;
let nextEventId = 21;
let nextInvoiceId = 21;
let nextInvoiceItemId = 121;
let nextInvoiceSeq = 21;

const serviceCatalogDb: ServiceRate[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const pricingPolicy = seq % 2 === 0 ? "KRW_FIXED" : "THB_BASED";
  const currency = pricingPolicy === "KRW_FIXED" ? "KRW" : "THB";
  return {
    id: seq,
    service_code: `SVC${pad2(seq)}`,
    service_name: `Sample Service ${pad2(seq)}`,
    billing_unit: (["ORDER", "SKU", "BOX", "CBM", "PALLET", "EVENT", "MONTH"] as const)[seq % 7],
    pricing_policy: pricingPolicy,
    default_currency: currency,
    default_rate: pricingPolicy === "KRW_FIXED" ? 800 + seq * 15 : Number((1.5 + seq * 0.1).toFixed(2)),
    status: seq % 6 === 0 ? "inactive" : "active",
  };
});

const contractRatesDb: ClientContractRate[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const serviceCode = serviceCatalogDb[index % serviceCatalogDb.length]?.service_code ?? "SVC01";
  return {
    id: seq,
    client_id: (seq % 10) + 1,
    service_code: serviceCode,
    custom_rate: 900 + seq * 25,
    currency: seq % 3 === 0 ? "THB" : "KRW",
    effective_date: `2026-${pad2(((seq - 1) % 12) + 1)}-01`,
  };
});

const exchangeRatesDb: ExchangeRate[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  return {
    id: seq,
    rate_date: `2026-${pad2(((seq - 1) % 12) + 1)}-${pad2(((seq - 1) % 27) + 1)}`,
    base_currency: "THB",
    quote_currency: "KRW",
    rate: Number((39 + seq * 0.07).toFixed(4)),
    source: seq % 4 === 0 ? "api" : "manual",
    locked: seq % 7 === 0 ? 1 : 0,
    status: seq % 6 === 0 ? "draft" : seq % 5 === 0 ? "superseded" : "active",
    used_invoice_count: 0,
  };
});

function pickFxRate(month?: string) {
  const candidates = exchangeRatesDb
    .filter((row) => !month || row.rate_date.startsWith(month))
    .sort((a, b) => b.rate_date.localeCompare(a.rate_date));
  return candidates[0] ?? exchangeRatesDb[0];
}

const eventsDb: BillingEvent[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const invoiceMonth = `2026-${pad2(((seq - 1) % 6) + 1)}`;
  const fx = pickFxRate(invoiceMonth);
  const amountThb = Number((20 + seq * 1.3).toFixed(2));
  return {
    id: seq,
    event_date: `${invoiceMonth}-${pad2(((seq - 1) % 27) + 1)}T09:30:00Z`,
    client_id: (seq % 10) + 1,
    client_code: `CL${pad2((seq % 20) + 1)}`,
    name_kr: `Sample Client ${pad2((seq % 20) + 1)}`,
    service_code: serviceCatalogDb[seq % serviceCatalogDb.length].service_code,
    qty: (seq % 5) + 1,
    amount_thb: amountThb,
    fx_rate_thbkrw: fx?.rate ?? 39,
    amount_krw: trunc100(amountThb * (fx?.rate ?? 39)),
    reference_type: seq % 2 === 0 ? "outbound" : "inbound",
    reference_id: String(3000 + seq),
    status: seq % 4 === 0 ? "INVOICED" : "PENDING",
    invoice_id: seq % 4 === 0 ? ((seq % 8) + 1) : null,
  };
});

const invoicesDb: BillingInvoice[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const invoiceMonth = `2026-${pad2(((seq - 1) % 6) + 1)}`;
  const fx = pickFxRate(invoiceMonth);
  const subtotal = trunc100(150000 + seq * 12345);
  const vat = trunc100(subtotal * 0.07);
  const status = (["draft", "issued", "paid"] as const)[seq % 3];
  return {
    id: seq,
    client_id: (seq % 10) + 1,
    client_code: `CL${pad2((seq % 20) + 1)}`,
    name_kr: `Sample Client ${pad2((seq % 20) + 1)}`,
    invoice_no: `INV-2026-${pad4(seq)}`,
    invoice_month: invoiceMonth,
    invoice_date: `${invoiceMonth}-25`,
    currency: "KRW",
    fx_rate_thbkrw: fx?.rate ?? 39,
    subtotal_krw: subtotal,
    vat_krw: vat,
    total_krw: subtotal + vat,
    status,
  };
});

const invoiceItemsDb: BillingInvoiceItem[] = invoicesDb.flatMap((invoice, index) =>
  Array.from({ length: 3 }, (_, line) => {
    const qty = line + 1;
    const unit = trunc100(10000 + index * 700 + line * 300);
    return {
      id: index * 3 + line + 1,
      invoice_id: invoice.id,
      service_code: serviceCatalogDb[(index + line) % serviceCatalogDb.length].service_code,
      description: `Sample line item ${line + 1} for ${invoice.invoice_no}`,
      qty,
      unit_price_krw: unit,
      amount_krw: unit * qty,
      unit_price_trunc100: unit,
      amount_trunc100: unit * qty,
    };
  })
);

function syncExchangeRateUsageCounts() {
  const usageByRateDate = new Map<string, number>();
  for (const invoice of invoicesDb) {
    const key = invoice.invoice_date.slice(0, 10);
    usageByRateDate.set(key, (usageByRateDate.get(key) ?? 0) + 1);
  }
  for (const row of exchangeRatesDb) {
    row.used_invoice_count = usageByRateDate.get(row.rate_date) ?? 0;
  }
}

syncExchangeRateUsageCounts();

function isEndpointUnavailableError(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  return [404, 501, 502, 503, 504].includes(status);
}

async function withFallback<T>(
  options: RequestOptions | undefined,
  backend: () => Promise<T>,
  fallback: () => Promise<T> | T
): Promise<T> {
  const token = await resolveToken(options?.token);
  if (shouldUseMockMode()) return clone(await fallback());
  try {
    const data = await backend();
    if (Array.isArray(data) && data.length === 0 && shouldUseFallback(token)) {
      return clone(await fallback());
    }
    return data;
  } catch (error) {
    if (shouldUseFallback(token) || isEndpointUnavailableError(error)) return clone(await fallback());
    throw error;
  }
}

function findInvoice(id: string | number) {
  const numericId = Number(id);
  const invoice = invoicesDb.find((row) => row.id === numericId);
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}

export async function listServiceRates(options?: RequestOptions) {
  return withFallback(
    options,
    () => requestJson<ServiceRate[]>("/billing/settings/service-catalog", undefined, options),
    () => serviceCatalogDb
  );
}

export async function createServiceRate(input: Omit<ServiceRate, "id">, options?: RequestOptions) {
  return withFallback(
    options,
    () =>
      requestJson<ServiceRate>(
        "/billing/settings/service-catalog",
        { method: "POST", body: JSON.stringify(input) },
        options
      ),
    () => {
      const code = input.service_code.trim().toUpperCase();
      if (!code) throw new Error("Service code is required.");
      if (serviceCatalogDb.some((row) => row.service_code === code)) throw new Error("Service code already exists.");
      const created: ServiceRate = { id: nextServiceRateId++, ...input, service_code: code };
      serviceCatalogDb.unshift(created);
      return created;
    }
  );
}

export async function updateServiceRate(serviceCode: string, input: Omit<ServiceRate, "id">, options?: RequestOptions) {
  return withFallback(
    options,
    () =>
      requestJson<ServiceRate>(
        `/billing/settings/service-catalog/${encodeURIComponent(serviceCode)}`,
        { method: "PUT", body: JSON.stringify(input) },
        options
      ),
    () => {
      const idx = serviceCatalogDb.findIndex((row) => row.service_code === serviceCode);
      if (idx < 0) throw new Error("Service rate not found.");
      const nextCode = input.service_code.trim().toUpperCase();
      if (
        serviceCatalogDb.some(
          (row, rowIndex) => row.service_code === nextCode && rowIndex !== idx
        )
      ) {
        throw new Error("Service code already exists.");
      }
      const updated: ServiceRate = { ...serviceCatalogDb[idx], ...input, service_code: nextCode };
      serviceCatalogDb[idx] = updated;
      return updated;
    }
  );
}

export async function deleteServiceRate(serviceCode: string, options?: RequestOptions) {
  return withFallback(
    options,
    () =>
      requestJson<{ ok: true }>(
        `/billing/settings/service-catalog/${encodeURIComponent(serviceCode)}`,
        { method: "DELETE" },
        options
      ),
    () => {
      const idx = serviceCatalogDb.findIndex((row) => row.service_code === serviceCode);
      if (idx < 0) throw new Error("Service rate not found.");
      serviceCatalogDb.splice(idx, 1);
      return { ok: true as const };
    }
  );
}

export async function listClientContractRates(query?: { client_id?: number }, options?: RequestOptions) {
  const params = new URLSearchParams();
  if (query?.client_id) params.set("client_id", String(query.client_id));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return withFallback(
    options,
    () => requestJson<ClientContractRate[]>(`/billing/settings/client-contract-rates${suffix}`, undefined, options),
    () =>
      query?.client_id
        ? contractRatesDb.filter((row) => row.client_id === query.client_id)
        : contractRatesDb
  );
}

export async function createClientContractRate(input: Omit<ClientContractRate, "id">, options?: RequestOptions) {
  return withFallback(
    options,
    () =>
      requestJson<ClientContractRate>(
        "/billing/settings/client-contract-rates",
        { method: "POST", body: JSON.stringify(input) },
        options
      ),
    () => {
      const created: ClientContractRate = { id: nextContractRateId++, ...input };
      contractRatesDb.unshift(created);
      return created;
    }
  );
}

export async function updateClientContractRate(id: number, input: Omit<ClientContractRate, "id">, options?: RequestOptions) {
  return withFallback(
    options,
    () =>
      requestJson<ClientContractRate>(
        `/billing/settings/client-contract-rates/${id}`,
        { method: "PUT", body: JSON.stringify(input) },
        options
      ),
    () => {
      const idx = contractRatesDb.findIndex((row) => row.id === id);
      if (idx < 0) throw new Error("Contract rate not found.");
      const updated: ClientContractRate = { ...contractRatesDb[idx], ...input, id };
      contractRatesDb[idx] = updated;
      return updated;
    }
  );
}

export async function deleteClientContractRate(id: number, options?: RequestOptions) {
  return withFallback(
    options,
    () => requestJson<{ ok: true }>(`/billing/settings/client-contract-rates/${id}`, { method: "DELETE" }, options),
    () => {
      const idx = contractRatesDb.findIndex((row) => row.id === id);
      if (idx < 0) throw new Error("Contract rate not found.");
      contractRatesDb.splice(idx, 1);
      return { ok: true as const };
    }
  );
}

export async function listExchangeRates(query?: { month?: string }, options?: RequestOptions) {
  const params = new URLSearchParams();
  if (query?.month) params.set("month", query.month);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const month = query?.month;
  return withFallback(
    options,
    () => requestJson<ExchangeRate[]>(`/billing/settings/exchange-rates${suffix}`, undefined, options),
    () => {
      syncExchangeRateUsageCounts();
      const filtered = month
        ? exchangeRatesDb.filter((row) => row.rate_date.startsWith(month))
        : exchangeRatesDb;
      return filtered;
    }
  );
}

export async function createExchangeRate(
  input: Omit<ExchangeRate, "id" | "base_currency" | "quote_currency"> & { entered_by?: number },
  options?: RequestOptions
) {
  return withFallback(
    options,
    () =>
      requestJson<ExchangeRate>(
        "/billing/settings/exchange-rates",
        { method: "POST", body: JSON.stringify(input) },
        options
      ),
    () => {
      const created: ExchangeRate = {
        id: nextExchangeRateId++,
        base_currency: "THB",
        quote_currency: "KRW",
        used_invoice_count: 0,
        ...input,
      };
      exchangeRatesDb.unshift(created);
      return created;
    }
  );
}

export async function updateExchangeRate(
  id: number,
  input: Omit<ExchangeRate, "id" | "base_currency" | "quote_currency">,
  options?: RequestOptions
) {
  return withFallback(
    options,
    () =>
      requestJson<ExchangeRate>(
        `/billing/settings/exchange-rates/${id}`,
        { method: "PUT", body: JSON.stringify(input) },
        options
      ),
    () => {
      const idx = exchangeRatesDb.findIndex((row) => row.id === id);
      if (idx < 0) throw new Error("Exchange rate not found.");
      const current = exchangeRatesDb[idx];
      const updated: ExchangeRate = {
        ...current,
        ...input,
        id,
        base_currency: "THB",
        quote_currency: "KRW",
      };
      exchangeRatesDb[idx] = updated;
      return updated;
    }
  );
}

export async function deleteExchangeRate(id: number, options?: RequestOptions) {
  return withFallback(
    options,
    () => requestJson<{ ok: true }>(`/billing/settings/exchange-rates/${id}`, { method: "DELETE" }, options),
    () => {
      const idx = exchangeRatesDb.findIndex((row) => row.id === id);
      if (idx < 0) throw new Error("Exchange rate not found.");
      if ((exchangeRatesDb[idx].used_invoice_count ?? 0) > 0) throw new Error("Exchange rate is used by invoices.");
      exchangeRatesDb.splice(idx, 1);
      return { ok: true as const };
    }
  );
}

export async function seedBillingEvents(input: { client_id: number; invoice_month: string }, options?: RequestOptions) {
  return withFallback(
    options,
    () =>
      requestJson<{ seeded: boolean }>(
        "/billing/events/sample",
        { method: "POST", body: JSON.stringify(input) },
        options
      ),
    () => {
      const existing = eventsDb.filter(
        (row) => row.client_id === input.client_id && row.event_date.startsWith(input.invoice_month)
      ).length;
      const target = 20;
      const toCreate = Math.max(0, target - existing);
      const fx = pickFxRate(input.invoice_month);
      for (let i = 0; i < toCreate; i += 1) {
        const seq = i + 1;
        const amountThb = Number((12 + seq * 1.8).toFixed(2));
        eventsDb.unshift({
          id: nextEventId++,
          event_date: `${input.invoice_month}-${pad2(((seq - 1) % 27) + 1)}T08:00:00Z`,
          client_id: input.client_id,
          client_code: `CL${pad2(input.client_id)}`,
          name_kr: `Sample Client ${pad2(input.client_id)}`,
          service_code: serviceCatalogDb[(seq - 1) % serviceCatalogDb.length].service_code,
          qty: (seq % 5) + 1,
          amount_thb: amountThb,
          fx_rate_thbkrw: fx?.rate ?? 39,
          amount_krw: trunc100(amountThb * (fx?.rate ?? 39)),
          reference_type: seq % 2 === 0 ? "outbound" : "inbound",
          reference_id: String(9000 + seq),
          status: "PENDING",
          invoice_id: null,
        });
      }
      return { seeded: true as const };
    }
  );
}

export async function listBillingEvents(
  query?: { client_id?: number; invoice_month?: string; status?: "PENDING" | "INVOICED"; service_code?: string },
  options?: RequestOptions
) {
  const params = new URLSearchParams();
  if (query?.client_id) params.set("client_id", String(query.client_id));
  if (query?.invoice_month) params.set("invoice_month", query.invoice_month);
  if (query?.status) params.set("status", query.status);
  if (query?.service_code) params.set("service_code", query.service_code);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return withFallback(
    options,
    () => requestJson<BillingEvent[]>(`/billing/events${suffix}`, undefined, options),
    () => {
      return eventsDb.filter((row) => {
        if (query?.client_id && row.client_id !== query.client_id) return false;
        if (query?.invoice_month && !row.event_date.startsWith(query.invoice_month)) return false;
        if (query?.status && row.status !== query.status) return false;
        if (query?.service_code && row.service_code !== query.service_code) return false;
        return true;
      });
    }
  );
}

export async function markBillingEventsPending(ids: number[], options?: RequestOptions) {
  return withFallback(
    options,
    () =>
      requestJson<{ updated: number }>(
        "/billing/events/mark-pending",
        { method: "POST", body: JSON.stringify({ ids }) },
        options
      ),
    () => {
      let updated = 0;
      for (const id of ids) {
        const idx = eventsDb.findIndex((row) => row.id === id);
        if (idx < 0) continue;
        const current = eventsDb[idx];
        if (current.status !== "PENDING" || current.invoice_id !== null) updated += 1;
        eventsDb[idx] = { ...current, status: "PENDING", invoice_id: null };
      }
      return { updated };
    }
  );
}

export function billingEventsCsvUrl(query?: {
  client_id?: number;
  invoice_month?: string;
  status?: "PENDING" | "INVOICED";
  service_code?: string;
}) {
  const params = new URLSearchParams();
  if (query?.client_id) params.set("client_id", String(query.client_id));
  if (query?.invoice_month) params.set("invoice_month", query.invoice_month);
  if (query?.status) params.set("status", query.status);
  if (query?.service_code) params.set("service_code", query.service_code);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return `/api/proxy/billing/events/export.csv${suffix}`;
}

export async function generateBillingInvoice(
  input: { client_id: number; invoice_month: string; invoice_date: string; regenerate_draft?: number },
  options?: RequestOptions
) {
  return withFallback(
    options,
    () =>
      requestJson<{ invoice: BillingInvoice; events_count: number; reused: boolean; invoice_id?: number }>(
        "/billing/invoices/generate",
        { method: "POST", body: JSON.stringify(input) },
        options
      ),
    () => {
      const existingPending = eventsDb.some(
        (row) =>
          row.client_id === input.client_id &&
          row.event_date.startsWith(input.invoice_month) &&
          row.status === "PENDING"
      );
      if (!existingPending) {
        const fx = pickFxRate(input.invoice_month);
        for (let i = 0; i < 12; i += 1) {
          const seq = i + 1;
          const amountThb = Number((15 + seq * 1.4).toFixed(2));
          eventsDb.unshift({
            id: nextEventId++,
            event_date: `${input.invoice_month}-${pad2(((seq - 1) % 27) + 1)}T08:00:00Z`,
            client_id: input.client_id,
            client_code: `CL${pad2(input.client_id)}`,
            name_kr: `Sample Client ${pad2(input.client_id)}`,
            service_code: serviceCatalogDb[(seq - 1) % serviceCatalogDb.length].service_code,
            qty: (seq % 5) + 1,
            amount_thb: amountThb,
            fx_rate_thbkrw: fx?.rate ?? 39,
            amount_krw: trunc100(amountThb * (fx?.rate ?? 39)),
            reference_type: seq % 2 === 0 ? "outbound" : "inbound",
            reference_id: String(9800 + seq),
            status: "PENDING",
            invoice_id: null,
          });
        }
      }

      const existingDraft = invoicesDb.find(
        (row) =>
          row.client_id === input.client_id &&
          row.invoice_month === input.invoice_month &&
          row.status === "draft"
      );
      if (existingDraft && !input.regenerate_draft) {
        return {
          invoice: clone(existingDraft),
          events_count: eventsDb.filter((row) => row.invoice_id === existingDraft.id).length,
          reused: true,
          invoice_id: existingDraft.id,
        };
      }

      if (existingDraft && input.regenerate_draft) {
        const idx = invoicesDb.findIndex((row) => row.id === existingDraft.id);
        if (idx >= 0) invoicesDb.splice(idx, 1);
      }

      const targets = eventsDb.filter(
        (row) =>
          row.client_id === input.client_id &&
          row.event_date.startsWith(input.invoice_month) &&
          row.status === "PENDING"
      );
      if (!targets.length) throw new Error("No pending billing events for this client/month.");

      const fx = pickFxRate(input.invoice_month);
      const subtotal = trunc100(targets.reduce((acc, row) => acc + Number(row.amount_krw ?? 0), 0));
      const vat = trunc100(subtotal * 0.07);
      const invoice: BillingInvoice = {
        id: nextInvoiceId++,
        client_id: input.client_id,
        client_code: `CL${pad2(input.client_id)}`,
        name_kr: `Sample Client ${pad2(input.client_id)}`,
        invoice_no: `INV-2026-${pad4(nextInvoiceSeq++)}`,
        invoice_month: input.invoice_month,
        invoice_date: input.invoice_date,
        currency: "KRW",
        fx_rate_thbkrw: fx?.rate ?? 39,
        subtotal_krw: subtotal,
        vat_krw: vat,
        total_krw: subtotal + vat,
        status: "draft",
      };
      invoicesDb.unshift(invoice);

      const grouped = new Map<string, BillingEvent[]>();
      for (const event of targets) {
        grouped.set(event.service_code, [...(grouped.get(event.service_code) ?? []), event]);
      }

      for (const [serviceCode, group] of grouped) {
        const qty = group.reduce((acc, row) => acc + row.qty, 0);
        const amount = trunc100(group.reduce((acc, row) => acc + Number(row.amount_krw ?? 0), 0));
        const unit = qty > 0 ? trunc100(amount / qty) : 0;
        invoiceItemsDb.push({
          id: nextInvoiceItemId++,
          invoice_id: invoice.id,
          service_code: serviceCode,
          description: `Auto grouped from ${group.length} events`,
          qty,
          unit_price_krw: unit,
          amount_krw: amount,
          unit_price_trunc100: unit,
          amount_trunc100: amount,
        });
      }

      for (const event of targets) {
        const idx = eventsDb.findIndex((row) => row.id === event.id);
        if (idx >= 0) eventsDb[idx] = { ...eventsDb[idx], status: "INVOICED", invoice_id: invoice.id };
      }
      syncExchangeRateUsageCounts();

      return { invoice: clone(invoice), events_count: targets.length, reused: false, invoice_id: invoice.id };
    }
  );
}

export async function listBillingInvoices(
  query?: { client_id?: number; invoice_month?: string; status?: string },
  options?: RequestOptions
) {
  const params = new URLSearchParams();
  if (query?.client_id) params.set("client_id", String(query.client_id));
  if (query?.invoice_month) params.set("invoice_month", query.invoice_month);
  if (query?.status) params.set("status", query.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return withFallback(
    options,
    () => requestJson<BillingInvoice[]>(`/billing/invoices${suffix}`, undefined, options),
    () =>
      invoicesDb.filter((row) => {
        if (query?.client_id && row.client_id !== query.client_id) return false;
        if (query?.invoice_month && row.invoice_month !== query.invoice_month) return false;
        if (query?.status && row.status !== query.status) return false;
        return true;
      })
  );
}

export async function getBillingInvoice(id: string | number, options?: RequestOptions) {
  return withFallback(
    options,
    () =>
      requestJson<{ invoice: BillingInvoice; items: BillingInvoiceItem[] }>(
        `/billing/invoices/${id}`,
        undefined,
        options
      ),
    () => {
      const invoice = findInvoice(id);
      const items = invoiceItemsDb.filter((row) => row.invoice_id === invoice.id);
      return { invoice, items };
    }
  );
}

export async function exportBillingInvoicePdf(id: string | number, options?: RequestOptions) {
  return withFallback(
    options,
    () => requestJson<{ status: string; message: string }>(`/billing/invoices/${id}/export-pdf`, undefined, options),
    () => ({ status: "stub", message: `PDF export queued for invoice ${id}` })
  );
}

export async function issueBillingInvoice(id: string | number, options?: RequestOptions) {
  return withFallback(
    options,
    () => requestJson<{ id: number; status: "issued" }>(`/billing/invoices/${id}/issue`, { method: "POST" }, options),
    () => {
      const invoice = findInvoice(id);
      if (invoice.status !== "draft") throw new Error("Only draft invoices can be issued.");
      invoice.status = "issued";
      return { id: invoice.id, status: "issued" as const };
    }
  );
}

export async function markBillingInvoicePaid(id: string | number, options?: RequestOptions) {
  return withFallback(
    options,
    () =>
      requestJson<{ id: number; status: "paid" }>(
        `/billing/invoices/${id}/mark-paid`,
        { method: "POST" },
        options
      ),
    () => {
      const invoice = findInvoice(id);
      if (invoice.status !== "issued") throw new Error("Only issued invoices can be marked paid.");
      invoice.status = "paid";
      return { id: invoice.id, status: "paid" as const };
    }
  );
}

export async function duplicateBillingInvoiceAdmin(id: string | number, options?: RequestOptions) {
  return withFallback(
    options,
    () => requestJson<BillingInvoice>(`/billing/invoices/${id}/duplicate-admin`, { method: "POST" }, options),
    () => {
      const original = findInvoice(id);
      const duplicated: BillingInvoice = {
        ...original,
        id: nextInvoiceId++,
        invoice_no: `INV-2026-${pad4(nextInvoiceSeq++)}`,
        status: "draft",
      };
      invoicesDb.unshift(duplicated);

      const originalItems = invoiceItemsDb.filter((row) => row.invoice_id === original.id);
      for (const item of originalItems) {
        invoiceItemsDb.push({
          ...item,
          id: nextInvoiceItemId++,
          invoice_id: duplicated.id,
        });
      }
      return duplicated;
    }
  );
}
