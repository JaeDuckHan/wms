import { requestJson, shouldUseMockMode, type RequestOptions } from "@/features/settings/shared/http";

export type ProductLotOption = {
  id: string;
  product_id: number;
  lot_no: string;
  expiry_date: string | null;
  mfg_date: string | null;
  status: "active" | "hold" | "expired" | "inactive" | string;
};

type RawProductLot = {
  id: number | string;
  product_id: number | string;
  lot_no?: string | null;
  expiry_date?: string | null;
  mfg_date?: string | null;
  status?: string | null;
};

function mapRawProductLot(raw: RawProductLot): ProductLotOption {
  return {
    id: String(raw.id),
    product_id: Number(raw.product_id),
    lot_no: raw.lot_no?.trim() || `LOT-${raw.id}`,
    expiry_date: raw.expiry_date ?? null,
    mfg_date: raw.mfg_date ?? null,
    status: raw.status ?? "active",
  };
}

export async function listProductLots(options?: RequestOptions): Promise<ProductLotOption[]> {
  if (shouldUseMockMode()) return [];
  const rows = await requestJson<RawProductLot[]>("/product-lots", undefined, options);
  return rows.map(mapRawProductLot);
}
