import type { Warehouse } from "@/features/settings/warehouses/types";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

const baseDate = new Date("2026-01-01T08:00:00Z");

export const warehousesMock: Warehouse[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const date = new Date(baseDate);
  date.setUTCDate(baseDate.getUTCDate() + index);
  return {
    id: `wh-${seq}`,
    warehouse_code: `WH-${pad2(seq)}`,
    name: `Sample Warehouse ${pad2(seq)}`,
    status: seq % 7 === 0 ? "inactive" : "active",
    created_at: date.toISOString(),
  };
});
