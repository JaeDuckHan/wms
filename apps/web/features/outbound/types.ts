export type OutboundStatus =
  | "draft"
  | "confirmed"
  | "allocated"
  | "picking"
  | "packing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";
export type OutboundAction = "allocate" | "pack" | "ship";
export type OutboundListStatus = OutboundStatus | "all";

export type OutboundItem = {
  id: string;
  product_id?: number;
  lot_id?: number | null;
  location_id?: number | null;
  barcode_full: string;
  product_name: string;
  lot: string;
  expiry_date: string | null;
  location: string;
  box_type?: string | null;
  box_count?: number;
  remark?: string | null;
  requested_qty: number;
  picked_qty: number;
  available_qty: number;
  reserved_qty: number;
  allocatable_qty: number;
  network_allocatable_qty: number;
  shortage_qty: number;
  status: "ready" | "shortage" | "picked" | "reallocate";
  allocation_plan: Array<{
    lot: string;
    location: string;
    allocatable_qty: number;
    suggested_qty: number;
  }>;
};

export type OutboundBox = {
  id: string;
  box_no: string;
  courier: string;
  tracking_no: string;
  item_count: number;
  status: "open" | "packed" | "shipped";
  items: OutboundBoxItem[];
};

export type OutboundBoxItem = {
  id: string;
  outbound_item_id: string;
  barcode_full: string;
  product_name: string;
  lot: string;
  location: string;
  requested_qty: number;
  packed_qty: number;
};

export type OutboundTimeline = {
  id: string;
  type: "created" | "allocated" | "packed" | "shipped" | "updated" | "cancelled";
  title: string;
  at: string;
  actor: string;
  note?: string;
};

export type OutboundOrder = {
  id: string;
  outbound_no: string;
  order_no: string;
  tracking_no: string;
  client: string;
  eta_date: string;
  status: OutboundStatus;
  memo: string;
  ship_to: string;
  summary: string;
  items: OutboundItem[];
  boxes: OutboundBox[];
  boxes_supported: boolean;
  timeline: OutboundTimeline[];
};

export type OutboundListQuery = {
  q?: string;
  status?: OutboundListStatus;
};
