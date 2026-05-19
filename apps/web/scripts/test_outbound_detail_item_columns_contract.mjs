import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function assertMatch(source, pattern, label) {
  if (!pattern.test(source)) {
    throw new Error(`${label}: expected OutboundDetailView item columns to match ${pattern}`);
  }
}

const detailView = read("features/outbound/OutboundDetailView.tsx");
const start = detailView.indexOf("const itemColumns = useMemo");
const end = detailView.indexOf("const buildEmptyBoxItems");

if (start < 0 || end < 0 || end <= start) {
  throw new Error("Unable to locate OutboundDetailView itemColumns block");
}

const itemColumns = detailView.slice(start, end);

assertMatch(
  itemColumns,
  /key:\s*"box_type"[\s\S]*?label:\s*"Box Type"[\s\S]*?row\.box_type\s*\?\?\s*"-"/,
  "Items tab must expose saved box type"
);

assertMatch(
  itemColumns,
  /key:\s*"box_count"[\s\S]*?label:\s*"Box Count"[\s\S]*?row\.box_count\s*\?\?\s*0/,
  "Items tab must expose saved box count"
);

console.log("outbound-detail-item-columns-contract-ok");
