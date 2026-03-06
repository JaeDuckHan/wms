export type ProductStatus = "active" | "inactive";

export type Product = {
  id: string;
  client_id?: number;
  client_code: string;
  client_name: string;
  barcode_raw: string;
  barcode_full: string;
  name: string;
  width_cm: number | null;
  length_cm: number | null;
  height_cm: number | null;
  cbm_m3: number | null;
  min_storage_fee_month: number;
  status: ProductStatus;
  created_at: string;
};

export type ProductFormInput = {
  client_code: string;
  client_id?: number;
  barcode_raw: string;
  name: string;
  width_cm?: number | null;
  length_cm?: number | null;
  height_cm?: number | null;
  cbm_m3?: number | null;
  min_storage_fee_month?: number | null;
  status?: ProductStatus;
};
