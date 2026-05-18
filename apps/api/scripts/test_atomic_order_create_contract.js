const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..", "..");

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

function functionTail(relPath, functionName) {
  const content = read(relPath);
  const start = content.indexOf(`export async function ${functionName}`);
  assert.ok(start >= 0, `expected ${relPath} to contain ${functionName}`);
  return content.slice(start);
}

assertIncludes(
  "apps/api/src/routes/inboundOrders.js",
  "items: z.array(inboundOrderItemSchema).default([])",
  "Inbound order create payload accepts items"
);

assertIncludes(
  "apps/api/src/routes/outboundOrders.js",
  "items: z.array(outboundOrderItemSchema).default([])",
  "Outbound order create payload accepts items"
);

assertMatches(
  "apps/api/src/routes/inboundOrders.js",
  /router\.post\("\/", validate\(inboundOrderCreateSchema\), async \(req, res\) => \{[\s\S]*?withTransaction\(async \(conn\)/,
  "Inbound order create runs order and item inserts in one transaction"
);

assertMatches(
  "apps/api/src/routes/outboundOrders.js",
  /router\.post\("\/", validate\(outboundOrderSchema\), async \(req, res\) => \{[\s\S]*?withTransaction\(async \(conn\)/,
  "Outbound order create runs order and item inserts in one transaction"
);

assertMatches(
  "apps/web/features/inbound/api.ts",
  /body: JSON\.stringify\(\{[\s\S]*?items: items\.map/,
  "Inbound web create sends items with the order create request"
);

assertMatches(
  "apps/web/features/outbound/api.ts",
  /body: JSON\.stringify\(\{[\s\S]*?items: items\.map/,
  "Outbound web create sends items with the order create request"
);

const inboundCreate = functionTail("apps/web/features/inbound/api.ts", "createInboundOrderWithItems");
const outboundCreate = functionTail("apps/web/features/outbound/api.ts", "createOutboundOrderWithItems");

assert.ok(!inboundCreate.includes('"/inbound-items"'), "Inbound web create should not post items after order creation");
assert.ok(!outboundCreate.includes('"/outbound-items"'), "Outbound web create should not post items after order creation");

console.log("atomic-order-create-contract-ok");
