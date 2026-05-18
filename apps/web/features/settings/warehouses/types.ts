export type WarehouseStatus = "active" | "inactive";
export type WarehouseLocationStatus = "active" | "inactive";

export type Warehouse = {
  id: string;
  warehouse_code: string;
  name: string;
  country: string;
  timezone: string;
  default_cbm_size: number;
  default_cbm_rate: number;
  status: WarehouseStatus;
  created_at: string;
};

export type WarehouseFormInput = {
  warehouse_code: string;
  name: string;
  country?: string;
  timezone?: string;
  default_cbm_size?: number;
  default_cbm_rate?: number;
  status?: WarehouseStatus;
};

export type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  location_code: string;
  zone: string | null;
  status: WarehouseLocationStatus;
  created_at: string;
};

export type WarehouseLocationFormInput = {
  warehouse_id: string | number;
  location_code: string;
  zone?: string | null;
  status?: WarehouseLocationStatus;
};

export type WarehouseLocationQuery = {
  warehouse_id?: string | number | null;
  status?: WarehouseLocationStatus | "all" | null;
};
