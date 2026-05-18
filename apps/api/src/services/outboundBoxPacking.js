class BoxPackingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BoxPackingError";
    this.code = code;
  }
}

function normalizeBoxItems(items) {
  const byItemId = new Map();
  for (const item of items) {
    const outboundItemId = Number(item.outbound_item_id);
    const packedQty = Number(item.packed_qty);
    if (!Number.isInteger(outboundItemId) || outboundItemId <= 0) {
      throw new BoxPackingError("INVALID_BOX_ITEM", "Box item must belong to outbound order");
    }
    if (!Number.isInteger(packedQty) || packedQty <= 0) {
      throw new BoxPackingError("INVALID_PACKED_QTY", "Packed qty must be greater than zero");
    }
    byItemId.set(outboundItemId, (byItemId.get(outboundItemId) ?? 0) + packedQty);
  }

  return [...byItemId.entries()].map(([outbound_item_id, packed_qty]) => ({
    outbound_item_id,
    packed_qty
  }));
}

function validateBoxItemTotals({
  nextItems,
  requestedQtyByItemId,
  existingPackedQtyByItemId
}) {
  const normalizedItems = normalizeBoxItems(nextItems);
  if (normalizedItems.length === 0) {
    throw new BoxPackingError("EMPTY_BOX_ITEMS", "Select at least one packed item");
  }

  for (const item of normalizedItems) {
    const requestedQty = Number(requestedQtyByItemId.get(Number(item.outbound_item_id)) ?? 0);
    if (!requestedQty) {
      throw new BoxPackingError("INVALID_BOX_ITEM", "Box item must belong to outbound order");
    }
    if (Number(item.packed_qty) > requestedQty) {
      throw new BoxPackingError("INVALID_PACKED_QTY", "Packed qty cannot exceed outbound item qty");
    }

    const existingPackedQty = Number(existingPackedQtyByItemId.get(Number(item.outbound_item_id)) ?? 0);
    if (existingPackedQty + Number(item.packed_qty) > requestedQty) {
      throw new BoxPackingError(
        "INVALID_PACKED_QTY_TOTAL",
        "Total packed qty cannot exceed outbound item qty"
      );
    }
  }

  return normalizedItems;
}

module.exports = {
  BoxPackingError,
  normalizeBoxItems,
  validateBoxItemTotals
};
