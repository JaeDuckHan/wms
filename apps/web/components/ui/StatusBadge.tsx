"use client";

import { Badge } from "@/components/ui/badge";
import { OutboundStatus } from "@/features/outbound/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
const statusMap: Record<OutboundStatus, { label: string; variant: "default" | "info" | "warning" | "success" }> = {
  draft: { label: "Draft", variant: "default" },
  confirmed: { label: "Confirmed", variant: "info" },
  allocated: { label: "Allocated", variant: "info" },
  picking: { label: "Picking", variant: "warning" },
  packing: { label: "Packing", variant: "warning" },
  packed: { label: "Packed", variant: "warning" },
  shipped: { label: "Shipped", variant: "success" },
  delivered: { label: "Delivered", variant: "success" },
  cancelled: { label: "Cancelled", variant: "default" },
};

export function StatusBadge({ status }: { status: OutboundStatus }) {
  const { t } = useI18n();
  const current = statusMap[status];
  return <Badge variant={current.variant}>{t(current.label)}</Badge>;
}


