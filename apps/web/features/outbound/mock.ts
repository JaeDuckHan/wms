import type {
  OutboundBox,
  OutboundItem,
  OutboundOrder,
  OutboundStatus,
  OutboundTimeline,
} from "@/features/outbound/types";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function pad4(value: number) {
  return String(value).padStart(4, "0");
}

const outboundStatuses: OutboundStatus[] = [
  "draft",
  "confirmed",
  "allocated",
  "picking",
  "packing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];
const baseDate = new Date("2026-02-01T08:30:00Z");

function buildItems(seq: number): OutboundItem[] {
  const itemCount = (seq % 3) + 1;
  return Array.from({ length: itemCount }, (_, idx) => {
    const requested = 10 + seq + idx * 3;
    const picked = idx % 3 === 0 ? requested : Math.max(requested - (idx + 2), 0);
    const available = idx % 2 === 0 ? requested + 8 : Math.max(requested - 4, 0);
    const status = picked >= requested ? "picked" : available < requested ? "shortage" : "ready";
    return {
      id: `OI-${seq}-${idx + 1}`,
      barcode_full: `CL${pad2(((seq + idx) % 10) + 1)}-8800${String(seq * 200 + idx + 1).padStart(9, "0")}`,
      product_name: `Sample Product ${pad2(((seq + idx) % 20) + 1)}`,
      lot: `LOT-26${pad2(((seq + idx) % 12) + 1)}-${String.fromCharCode(65 + (idx % 3))}`,
      location: `B-${pad2((seq % 10) + 1)}-${pad2((idx % 8) + 1)}`,
      requested_qty: requested,
      picked_qty: picked,
      available_qty: available,
      status,
    };
  });
}

function buildBoxes(seq: number, status: OutboundStatus): OutboundBox[] {
  if (!["packed", "shipped", "delivered"].includes(status)) return [];
  return [
    {
      id: `BOX-${seq}-1`,
      box_no: `BOX-${pad4(seq)}-1`,
      courier: seq % 2 === 0 ? "CJ Logistics" : "Hanjin",
      tracking_no: `TRK-${String(70000000 + seq).padStart(8, "0")}`,
      item_count: (seq % 3) + 1,
    },
  ];
}

function mapTimelineType(status: OutboundStatus): OutboundTimeline["type"] {
  if (status === "shipped" || status === "delivered") return "shipped";
  if (status === "packed" || status === "packing") return "packed";
  if (status === "cancelled") return "cancelled";
  if (status === "allocated" || status === "picking" || status === "confirmed") return "allocated";
  return "updated";
}

export const outboundOrdersMock: OutboundOrder[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const current = new Date(baseDate);
  current.setUTCDate(baseDate.getUTCDate() + index);
  const status = outboundStatuses[index % outboundStatuses.length];
  const items = status === "draft" ? [] : buildItems(seq);
  const boxes = buildBoxes(seq, status);
  const totalQty = items.reduce((acc, item) => acc + item.requested_qty, 0);
  const outboundNo = `OB-202602${pad2((seq % 28) + 1)}-${pad4(seq)}`;
  return {
    id: outboundNo,
    outbound_no: outboundNo,
    client: `Sample Client ${pad2(((seq - 1) % 20) + 1)}`,
    eta_date: current.toISOString().slice(0, 10),
    status,
    memo: `Outbound QA sample #${pad2(seq)}`,
    ship_to: `Seoul Test District ${pad2(seq)}, 3PL Street ${seq}`,
    summary: `${items.length} SKUs / ${totalQty} EA`,
    items,
    boxes,
    boxes_supported: true,
    timeline: [
      {
        id: `TL-${seq}-1`,
        type: "created",
        title: "Order Created",
        at: `${current.toISOString().slice(0, 10)} 08:30`,
        actor: "admin",
      },
      ...(status !== "draft"
        ? [
            {
              id: `TL-${seq}-2`,
              type: mapTimelineType(status),
              title: `Status Updated: ${status.toUpperCase()}`,
              at: `${current.toISOString().slice(0, 10)} 10:30`,
              actor: "qa_user",
              note: "Auto-generated sample timeline.",
            },
          ]
        : []),
    ],
  };
});

export function getOutboundByNo(outboundNo: string) {
  return outboundOrdersMock.find((item) => item.outbound_no === outboundNo) ?? null;
}
