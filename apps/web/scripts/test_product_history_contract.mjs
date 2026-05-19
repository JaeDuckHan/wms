import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..", "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function assertIncludes(relPath, expected, label) {
  const content = read(relPath);
  assert.ok(content.includes(expected), `${label}: expected ${relPath} to include ${expected}`);
}

assertIncludes(
  "apps/web/components/layout/Sidebar.tsx",
  'href: "/inventory/product-history"',
  "Sidebar exposes product in/out history as a first-class navigation item"
);

assertIncludes(
  "apps/web/app/(console)/inventory/product-history/page.tsx",
  'title="Product In/Out History"',
  "Product history route has a product-focused page title"
);

assertIncludes(
  "apps/web/app/(console)/inventory/product-history/page.tsx",
  "const hasActiveFilter = Boolean(q?.trim() || txn_type || product_id || client_id || warehouse_id || date_from || date_to);",
  "Product history route does not load the full ledger until a filter is active"
);

assertIncludes(
  "apps/web/app/(console)/inventory/product-history/page.tsx",
  "hasActiveFilter ? getStockTransactions({ q, txn_type, product_id, client_id, warehouse_id, date_from, date_to, page: String(currentPage), limit: String(pageSize) }, { token }) : Promise.resolve([])",
  "Product history route only loads a paginated transaction ledger after filters are set"
);

assertIncludes(
  "apps/web/app/(console)/inventory/product-history/page.tsx",
  "const pageSize = 100;",
  "Product history route caps each ledger load"
);

assertIncludes(
  "apps/web/app/(console)/inventory/product-history/page.tsx",
  "name=\"page\"",
  "Product history route preserves page state explicitly"
);

for (const inputName of ['name="product_id"', 'name="client_id"', 'name="warehouse_id"', 'name="date_from"', 'name="date_to"']) {
  assertIncludes(
    "apps/web/app/(console)/inventory/product-history/page.tsx",
    inputName,
    `Product history filter includes ${inputName}`
  );
}

assertIncludes(
  "apps/web/app/(console)/inventory/product-history/page.tsx",
  "<InventoryTransactionsTable rows={transactions} />",
  "Product history route reuses the ledger transaction table"
);

assertIncludes(
  "apps/web/features/inventory/types.ts",
  "date_from?: string;",
  "Inventory transaction queries support a start date"
);

assertIncludes(
  "apps/web/features/inventory/types.ts",
  "date_to?: string;",
  "Inventory transaction queries support an end date"
);

assertIncludes(
  "apps/web/features/inventory/types.ts",
  "page?: string;",
  "Inventory transaction queries support pagination page"
);

assertIncludes(
  "apps/web/features/inventory/types.ts",
  "limit?: string;",
  "Inventory transaction queries support pagination limits"
);

assertIncludes(
  "apps/web/features/inventory/types.ts",
  "client_id?: string;",
  "Inventory transaction queries support client filtering"
);

assertIncludes(
  "apps/web/features/inventory/types.ts",
  "warehouse_id?: string;",
  "Inventory transaction queries support warehouse filtering"
);

assertIncludes(
  "apps/web/features/inventory/api.ts",
  'if (query?.date_from) params.set("date_from", query.date_from);',
  "Stock transaction API client forwards date_from"
);

assertIncludes(
  "apps/web/features/inventory/api.ts",
  'if (query?.date_to) params.set("date_to", query.date_to);',
  "Stock transaction API client forwards date_to"
);

assertIncludes(
  "apps/web/features/inventory/api.ts",
  'if (query?.q?.trim()) params.set("q", query.q.trim());',
  "Stock transaction API client forwards q for server-side filtering"
);

assertIncludes(
  "apps/web/features/inventory/api.ts",
  'params.set("offset", String((page - 1) * limit));',
  "Stock transaction API client converts page to an API offset"
);

assertIncludes(
  "apps/web/app/(console)/inbounds/page.tsx",
  'buildProductHistoryHref(firstItem.product_id, "inbound_receive")',
  "Inbound item product links open inbound product history"
);

assertIncludes(
  "apps/web/app/(console)/outbounds/page.tsx",
  'buildProductHistoryHref(firstItem.product_id, "outbound_ship")',
  "Outbound item product links open outbound product history"
);

assertIncludes(
  "apps/web/features/inventory/productHistoryLinks.ts",
  "export function buildProductHistoryHref",
  "Product history links are built by a shared helper"
);

assertIncludes(
  "apps/web/features/inbound/InboundDetailView.tsx",
  'buildProductHistoryHref(row.product_id, "inbound_receive")',
  "Inbound detail item table links every product to inbound product history"
);

assertIncludes(
  "apps/web/features/outbound/OutboundDetailView.tsx",
  'buildProductHistoryHref(row.product_id, "outbound_ship")',
  "Outbound detail item table links every product to outbound product history"
);

console.log("product-history-contract-ok");
