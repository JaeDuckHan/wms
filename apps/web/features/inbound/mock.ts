import type { InboundItem, InboundOrder, InboundStatus, InboundTimeline } from "@/features/inbound/types";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function pad4(value: number) {
  return String(value).padStart(4, "0");
}

const inboundStatuses: InboundStatus[] = ["draft", "submitted", "arrived", "qc_hold", "received", "cancelled"];
const baseDate = new Date("2026-02-01T09:00:00Z");

function buildItems(seq: number): InboundItem[] {
  const itemCount = (seq % 3) + 1;
  return Array.from({ length: itemCount }, (_, idx) => {
    const qty = 8 + seq + idx * 4;
    return {
      id: `II-${seq}-${idx + 1}`,
      barcode_full: `CL${pad2(((seq + idx) % 10) + 1)}-8800${String(seq * 100 + idx + 1).padStart(9, "0")}`,
      product_name: `Sample Product ${pad2(((seq + idx) % 20) + 1)}`,
      lot: `LOT-26${pad2(((seq + idx) % 12) + 1)}-${String.fromCharCode(65 + (idx % 3))}`,
      location: `A-${pad2((seq % 12) + 1)}-${pad2((idx % 8) + 1)}`,
      qty,
      invoice_price: idx % 2 === 0 ? Number((6 + (seq % 7) + idx * 0.5).toFixed(2)) : null,
      currency: idx % 2 === 0 ? "THB" : null,
      remark: idx % 2 === 0 ? "ok" : null,
    };
  });
}

function mapTimelineType(status: InboundStatus): InboundTimeline["type"] {
  if (status === "received") return "received";
  if (status === "arrived") return "arrived";
  if (status === "cancelled") return "cancelled";
  if (status === "submitted") return "submitted";
  return "updated";
}

export const inboundOrdersMock: InboundOrder[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const current = new Date(baseDate);
  current.setUTCDate(baseDate.getUTCDate() + index);
  const status = inboundStatuses[index % inboundStatuses.length];
  const items = status === "draft" ? [] : buildItems(seq);
  const totalQty = items.reduce((acc, item) => acc + item.qty, 0);
  const inboundNo = `IB-202602${pad2((seq % 28) + 1)}-${pad4(seq)}`;
  return {
    id: inboundNo,
    inbound_no: inboundNo,
    client: `Sample Client ${pad2(((seq - 1) % 20) + 1)}`,
    inbound_date: current.toISOString().slice(0, 10),
    status,
    memo: `Inbound QA sample #${pad2(seq)}`,
    warehouse: `Warehouse #${pad2(((seq - 1) % 20) + 1)}`,
    summary: `${items.length} SKUs / ${totalQty} EA`,
    items,
    timeline: [
      {
        id: `ITL-${seq}-1`,
        type: "created",
        title: "Inbound Created",
        at: `${current.toISOString().slice(0, 10)} 09:00`,
        actor: "admin",
      },
      ...(status !== "draft"
        ? [
            {
              id: `ITL-${seq}-2`,
              type: mapTimelineType(status),
              title: `Inbound ${status.toUpperCase()}`,
              at: `${current.toISOString().slice(0, 10)} 11:00`,
              actor: "qa_user",
            },
          ]
        : []),
    ],
  };
});

export function getInboundByNo(inboundNo: string) {
  return inboundOrdersMock.find((item) => item.inbound_no === inboundNo) ?? null;
}
