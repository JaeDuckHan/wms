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

function assertMatches(relPath, pattern, label) {
  const content = read(relPath);
  assert.ok(pattern.test(content), `${label}: expected ${relPath} to match ${pattern}`);
}

assertIncludes(
  "apps/web/features/inventory/types.ts",
  "client_id: string;",
  "Inventory transaction rows keep client id for client links"
);

assertIncludes(
  "apps/web/features/inventory/types.ts",
  "product_id: string;",
  "Inventory transaction rows keep product id for product history links"
);

assertMatches(
  "apps/web/features/inventory/api.ts",
  /includesQ\([^)]*row\.client[^)]*row\.product[^)]*row\.product_barcode/s,
  "Inventory transaction search covers client and product fields"
);

assertIncludes(
  "apps/web/app/(console)/inventory/page.tsx",
  "<InventoryTransactionsTable",
  "Inventory transactions render through the layer-enabled client component"
);

assertIncludes(
  "apps/web/features/inventory/InventoryTransactionsTable.tsx",
  "openClientLayer(row)",
  "Inventory transaction client cell opens a client info layer"
);

assertIncludes(
  "apps/web/features/inventory/InventoryTransactionsTable.tsx",
  "openProductHistoryLayer(row)",
  "Inventory transaction product cell opens a product history layer"
);

assertIncludes(
  "apps/web/features/inventory/InventoryTransactionsTable.tsx",
  "getStockTransactions({ product_id: row.product_id })",
  "Product layer loads full product transaction history"
);

assertIncludes(
  "apps/web/features/inventory/InventoryTransactionsTable.tsx",
  "clientCache",
  "Client layer caches client lookups between clicks"
);

assertIncludes(
  "apps/web/features/inventory/InventoryTransactionsTable.tsx",
  "productHistoryCache",
  "Product layer caches product history between clicks"
);

assertIncludes(
  "apps/web/features/inventory/InventoryTransactionsTable.tsx",
  "Client Info",
  "Client layer labels the client information panel"
);

assertIncludes(
  "apps/web/features/inventory/InventoryTransactionsTable.tsx",
  "Product In/Out History",
  "Product layer labels the product history panel"
);

assertIncludes(
  "apps/web/app/(console)/inventory/page.tsx",
  'name="q"',
  "Inventory transaction filters include a visible search input"
);

assertIncludes(
  "apps/web/app/(console)/settings/clients/page.tsx",
  "initialSearch={q ?? \"\"}",
  "Client settings page accepts inventory client search links"
);

console.log("inventory-transactions-contract-ok");
