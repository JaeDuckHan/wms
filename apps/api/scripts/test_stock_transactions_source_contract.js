const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function assertIncludes(relPath, expected, label) {
  const content = read(relPath);
  assert.ok(content.includes(expected), `${label}: expected ${relPath} to include ${expected}`);
}

assertIncludes(
  "src/routes/stocks.js",
  "LEFT JOIN inbound_items",
  "Stock transactions join inbound items for source documents"
);

assertIncludes(
  "src/routes/stocks.js",
  "LEFT JOIN outbound_items",
  "Stock transactions join outbound items for source documents"
);

assertIncludes(
  "src/routes/stocks.js",
  "LEFT JOIN return_items",
  "Stock transactions join return items for source documents"
);

assertIncludes(
  "src/routes/stocks.js",
  "AS source_no",
  "Stock transactions expose source document number"
);

assertIncludes(
  "src/routes/stocks.js",
  "const searchTerm = String(q ?? \"\").trim();",
  "Stock transactions trim q before server-side filtering"
);

assertIncludes(
  "src/routes/stocks.js",
  "const search = searchTerm ? `%${searchTerm}%` : null;",
  "Stock transactions ignore blank q values"
);

assertIncludes(
  "src/routes/stocks.js",
  "warehouse_id",
  "Stock transaction filters include warehouse_id"
);

assertIncludes(
  "src/routes/stocks.js",
  "LIMIT ? OFFSET ?",
  "Stock transactions are capped and paginated"
);

assertIncludes(
  "src/routes/stocks.js",
  "p.barcode_full LIKE ?",
  "Stock transaction q filtering searches product barcodes server-side"
);

assertIncludes(
  "src/routes/stocks.js",
  "io.inbound_no LIKE ?",
  "Stock transaction q filtering searches source document numbers server-side"
);

console.log("stock-transactions-source-contract-ok");
