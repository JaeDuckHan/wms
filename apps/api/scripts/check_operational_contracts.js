const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..", "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function assertIncludes(relPath, expected, label) {
  const content = read(relPath);
  if (!content.includes(expected)) {
    throw new Error(`${label}: expected ${relPath} to include ${expected}`);
  }
}

function assertMatches(relPath, pattern, label) {
  const content = read(relPath);
  if (!pattern.test(content)) {
    throw new Error(`${label}: expected ${relPath} to match ${pattern}`);
  }
}

assertMatches(
  "apps/api/src/routes/inboundItems.js",
  /currency:\s*z\.enum\(\[\s*"KRW",\s*"THB",\s*"USD"\s*\]\)/,
  "Inbound item API accepts USD"
);

assertMatches(
  "apps/api/sql/schema_v1.sql",
  /inbound_items[\s\S]*currency ENUM\('KRW','THB','USD'\) NULL/,
  "Inbound item schema stores USD"
);

assertIncludes(
  "apps/api/sql/patch_runtime_operational_tables.sql",
  "outbound_box_items",
  "Runtime SQL creates outbound box item links"
);

assertIncludes(
  "apps/api/src/routes/outboundBoxes.js",
  "outbound_box_items",
  "Outbound box API persists item links"
);

assertIncludes(
  "apps/api/src/routes/outboundItems.js",
  "assertPackedQtyWithinItemQty",
  "Outbound item update rejects quantities below packed totals"
);

assertIncludes(
  "apps/api/src/routes/outboundItems.js",
  "softDeletePackedItemsForOutboundItem",
  "Outbound item delete cleans packed box item links"
);

assertMatches(
  "apps/web/features/operations/OrderCreateForm.tsx",
  /"KRW" \| "THB" \| "USD"/,
  "Order form allows USD"
);

assertIncludes(
  "apps/web/features/operations/OrderCreateForm.tsx",
  "Total Amount",
  "Order form shows computed inbound totals"
);

assertIncludes(
  "apps/web/features/outbound/types.ts",
  "items: OutboundBoxItem[]",
  "Outbound boxes expose packed item details"
);

assertIncludes(
  "apps/web/features/outbound/api.ts",
  "updateOutboundBox",
  "Outbound box edit API client is available"
);

assertIncludes(
  "apps/web/features/outbound/api.ts",
  "deleteOutboundBox",
  "Outbound box delete API client is available"
);

assertIncludes(
  "apps/web/features/outbound/OutboundDetailView.tsx",
  "Edit Box",
  "Outbound box list exposes edit actions"
);

assertIncludes(
  "apps/web/features/outbound/OutboundDetailView.tsx",
  "Delete Box",
  "Outbound box list exposes delete actions"
);

assertIncludes(
  "apps/web/features/inventory/types.ts",
  "product_id?: string",
  "Inventory transaction query supports product filtering"
);

console.log("operational-contracts-ok");
