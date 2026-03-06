import type { Product } from "@/features/settings/products/types";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function pad13(value: number) {
  return String(value).padStart(13, "0");
}

const baseDate = new Date("2026-01-01T10:10:00Z");

export const productsMock: Product[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const clientCode = `CL${pad2(((index % 10) + 1))}`;
  const barcodeRaw = `8800${pad13(seq)}`;
  const date = new Date(baseDate);
  date.setUTCDate(baseDate.getUTCDate() + index);
  const widthCm = 20 + (seq % 5) * 5;
  const lengthCm = 25 + (seq % 4) * 4;
  const heightCm = 10 + (seq % 3) * 3;
  return {
    id: `prd-${seq}`,
    client_id: ((index % 10) + 1),
    client_code: clientCode,
    client_name: `Client ${clientCode}`,
    barcode_raw: barcodeRaw,
    barcode_full: `${clientCode}-${barcodeRaw}`,
    name: `Sample Product ${pad2(seq)}`,
    width_cm: widthCm,
    length_cm: lengthCm,
    height_cm: heightCm,
    cbm_m3: Number(((widthCm * lengthCm * heightCm) / 1000000).toFixed(6)),
    min_storage_fee_month: seq % 4 === 0 ? 200 : 0,
    status: seq % 6 === 0 ? "inactive" : "active",
    created_at: date.toISOString(),
  };
});
