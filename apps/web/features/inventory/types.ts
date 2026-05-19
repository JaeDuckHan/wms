export type InventoryTab = "balances" | "transactions";

export type StockBalanceRow = {
  id: string;
  client_id: string;
  product_id: string;
  client_code: string;
  product_barcode: string;
  client: string;
  product: string;
  lot: string;
  warehouse: string;
  location: string;
  available_qty: number;
  reserved_qty: number;
  allocatable_qty: number;
  reservation_rate_pct: number;
  reservation_status: "low" | "medium" | "high" | "full";
};

export type StockTransactionRow = {
  id: string;
  client_id: string;
  product_id: string;
  client_code: string;
  product_barcode: string;
  txn_date: string;
  txn_type: string;
  client: string;
  product: string;
  lot: string;
  warehouse: string;
  location: string;
  qty_in: number;
  qty_out: number;
  current_stock_qty: number;
  ref: string;
  source_no: string;
  source_path: string;
  note: string;
};

export type InventoryQuery = {
  q?: string;
  txn_type?: string;
  product_id?: string;
  client_id?: string;
  warehouse_id?: string;
  date_from?: string;
  date_to?: string;
  page?: string;
  limit?: string;
};
