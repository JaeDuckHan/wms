const assert = require("assert");

const {
  normalizeBoxItems,
  validateBoxItemTotals
} = require("../src/services/outboundBoxPacking");

const aggregated = normalizeBoxItems([
  { outbound_item_id: "101", packed_qty: 2 },
  { outbound_item_id: 101, packed_qty: 3 },
  { outbound_item_id: 102, packed_qty: 1 }
]);

assert.deepStrictEqual(aggregated, [
  { outbound_item_id: 101, packed_qty: 5 },
  { outbound_item_id: 102, packed_qty: 1 }
]);

assert.throws(
  () =>
    validateBoxItemTotals({
      nextItems: [],
      requestedQtyByItemId: new Map([[101, 10]]),
      existingPackedQtyByItemId: new Map()
    }),
  (error) => error.code === "EMPTY_BOX_ITEMS"
);

assert.throws(
  () =>
    validateBoxItemTotals({
      nextItems: [{ outbound_item_id: 101, packed_qty: 6 }],
      requestedQtyByItemId: new Map([[101, 10]]),
      existingPackedQtyByItemId: new Map([[101, 5]])
    }),
  (error) => error.code === "INVALID_PACKED_QTY_TOTAL"
);

assert.throws(
  () =>
    validateBoxItemTotals({
      nextItems: [{ outbound_item_id: 999, packed_qty: 1 }],
      requestedQtyByItemId: new Map([[101, 10]]),
      existingPackedQtyByItemId: new Map()
    }),
  (error) => error.code === "INVALID_BOX_ITEM"
);

const validated = validateBoxItemTotals({
  nextItems: [{ outbound_item_id: 101, packed_qty: 5 }],
  requestedQtyByItemId: new Map([[101, 10]]),
  existingPackedQtyByItemId: new Map([[101, 5]])
});

assert.deepStrictEqual(validated, [{ outbound_item_id: 101, packed_qty: 5 }]);

console.log("outbound-box-packing-contract-ok");
