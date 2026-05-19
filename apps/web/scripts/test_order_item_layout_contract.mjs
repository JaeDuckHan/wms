import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function assertIncludes(relPath, expected, label) {
  const content = read(relPath);
  if (!content.includes(expected)) {
    throw new Error(`${label}: expected ${relPath} to include ${expected}`);
  }
}

function assertNotIncludes(relPath, expected, label) {
  const content = read(relPath);
  if (content.includes(expected)) {
    throw new Error(`${label}: expected ${relPath} not to include ${expected}`);
  }
}

const formPath = "features/operations/OrderCreateForm.tsx";

assertIncludes(
  formPath,
  "const showItemLabels = index === 0;",
  "Only the first order item shows field labels"
);

assertIncludes(
  formPath,
  "gridTemplateColumns: mode === \"inbound\" ? inboundItemGridTemplate : outboundItemGridTemplate",
  "Order item fields use one row template per mode"
);

assertIncludes(
  formPath,
  "showItemLabels ? <span className={inputLabelClass}>Product</span> : null",
  "Product label is English-only and hidden after the first item"
);

assertIncludes(
  formPath,
  "showItemLabels ? <span className={inputLabelClass}>Lot No</span> : null",
  "Lot label is English-only"
);

assertIncludes(
  formPath,
  "showItemLabels ? <span className={inputLabelClass}>Stock Location</span> : null",
  "Stock location label is English-only"
);

assertIncludes(
  formPath,
  "showItemLabels ? <span className={inputLabelClass}>Qty</span> : null",
  "Qty label is English-only"
);

assertIncludes(
  formPath,
  "showItemLabels ? <div className=\"mb-3 flex items-center justify-between gap-3\">",
  "Item title row is hidden after the first item"
);

assertNotIncludes(
  formPath,
  "mt-3 grid gap-3 md:grid-cols-4",
  "Inbound item layout no longer splits fields into a second row"
);

assertNotIncludes(
  formPath,
  "mt-3 grid gap-3 md:grid-cols-3",
  "Outbound item layout no longer splits fields into a second row"
);

console.log("order-item-layout-contract-ok");
