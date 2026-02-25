import type { Client } from "@/features/settings/clients/types";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

const baseDate = new Date("2026-01-01T09:00:00Z");

export const clientsMock: Client[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const date = new Date(baseDate);
  date.setUTCDate(baseDate.getUTCDate() + index);
  return {
    id: `cl-${seq}`,
    client_code: `CL${pad2(seq)}`,
    name: `Sample Client ${pad2(seq)}`,
    memo: seq % 4 === 0 ? "Priority account for CRUD QA" : "",
    status: seq % 5 === 0 ? "inactive" : "active",
    created_at: date.toISOString(),
  };
});
