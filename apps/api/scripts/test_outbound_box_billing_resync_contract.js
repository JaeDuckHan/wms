const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

const route = read("src/routes/outboundBoxes.js");

assert.ok(
  route.includes("syncOutboundOrderBillingEvent"),
  "outbound box mutations must import billing event sync"
);

const syncCallCount = (route.match(/syncOutboundOrderBillingEvent\(conn, outboundOrderId\)/g) || []).length;
assert.ok(
  syncCallCount >= 4,
  `expected box create/update/delete flows to resync outbound billing, got ${syncCallCount} calls`
);

assert.match(
  route,
  /await syncOutboundOrderBillingEvent\(conn, outboundOrderId\);\s*await conn\.commit\(\);/,
  "billing sync should happen inside the same box mutation transaction before commit"
);

console.log("outbound-box-billing-resync-contract-ok");
