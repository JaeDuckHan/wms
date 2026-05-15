import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assertIncludes(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

function assertNotIncludes(source, needle, message) {
  if (source.includes(needle)) {
    throw new Error(message);
  }
}

function assertFile(relativePath, message) {
  if (!fs.existsSync(path.join(ROOT, relativePath))) {
    throw new Error(message);
  }
}

const orderCreate = read("features/operations/OrderCreateForm.tsx");
const inboundDetail = read("features/inbound/InboundDetailView.tsx");
const outboundDetail = read("features/outbound/OutboundDetailView.tsx");
const inboundApi = read("features/inbound/api.ts");
const outboundApi = read("features/outbound/api.ts");
const productsSettings = read("features/settings/products/ProductsSettingsPage.tsx");
const settingsTabs = read("components/settings/SettingsTabs.tsx");
const inventoryPage = read("app/(console)/inventory/page.tsx");
const inventoryTypes = read("features/inventory/types.ts");

for (const source of [orderCreate, inboundDetail, outboundDetail, productsSettings]) {
  assertNotIncludes(source, "?낃", "PPT UX cleanup must not leave mojibake Korean text in edited UI files.");
  assertNotIncludes(source, "?몃", "PPT UX cleanup must not leave mojibake Korean text in edited UI files.");
}

assertNotIncludes(
  outboundDetail,
  "Mock form with client-side validation.",
  "Outbound box dialog must not tell users this is a mock form."
);

assertNotIncludes(
  productsSettings,
  "Barcode Full (Preview)",
  "Product settings should remove the barcode full preview called out in the PPT."
);
assertNotIncludes(
  productsSettings,
  'key: "barcode_full"',
  "Product settings table should not show the barcode full value as a primary column."
);

assertIncludes(orderCreate, "itemErrors", "Order create form must keep per-item field errors.");
assertIncludes(orderCreate, "aria-invalid", "Order create form must mark invalid fields in place.");
assertIncludes(orderCreate, "No stock is available for this product lot.", "Outbound lot-less/stock-empty cases need visible guidance.");
assertIncludes(orderCreate, "Available stock", "Outbound creation must show available stock before submit.");

assertIncludes(inboundDetail, "updateInboundItem", "Inbound detail must expose item update from the existing item API.");
assertIncludes(inboundDetail, "deleteInboundItem", "Inbound detail must expose item delete from the existing item API.");
assertIncludes(outboundDetail, "updateOutboundItem", "Outbound detail must expose item update from the existing item API.");
assertIncludes(outboundDetail, "deleteOutboundItem", "Outbound detail must expose item delete from the existing item API.");
assertIncludes(outboundDetail, "editOrderNo", "Outbound edit dialog must expose platform order number editing.");
assertIncludes(outboundDetail, "editTrackingNo", "Outbound edit dialog must expose tracking number editing.");
assertIncludes(outboundDetail, "Order No", "Outbound edit dialog must label the order number field.");
assertIncludes(outboundDetail, "Tracking No", "Outbound edit dialog must label the tracking number field.");
assertIncludes(outboundDetail, "order_no: editOrderNo.trim() || null", "Outbound edit save must persist order number.");
assertIncludes(outboundDetail, "tracking_no: editTrackingNo.trim() || null", "Outbound edit save must persist tracking number.");
assertIncludes(outboundDetail, "data-testid={`outbound-item-edit-${row.id}`}", "Outbound item edit action must be directly testable per row.");
assertIncludes(outboundDetail, "data-testid={`outbound-item-delete-${row.id}`}", "Outbound item delete action must be directly testable per row.");
assertIncludes(outboundDetail, "aria-label={`Edit outbound item ${row.product_name}`}", "Outbound item edit action must have a row-specific accessible name.");
assertIncludes(outboundDetail, "aria-label={`Delete outbound item ${row.product_name}`}", "Outbound item delete action must have a row-specific accessible name.");
assertIncludes(inboundDetail, "data-testid={`inbound-item-edit-${row.id}`}", "Inbound item edit action must be directly testable per row.");
assertIncludes(inboundDetail, "data-testid={`inbound-item-delete-${row.id}`}", "Inbound item delete action must be directly testable per row.");
assertIncludes(inboundDetail, "aria-label={`Edit inbound item ${row.product_name}`}", "Inbound item edit action must have a row-specific accessible name.");
assertIncludes(inboundDetail, "aria-label={`Delete inbound item ${row.product_name}`}", "Inbound item delete action must have a row-specific accessible name.");
assertIncludes(inboundApi, "export async function updateInboundItem", "Inbound API wrapper must include item update.");
assertIncludes(inboundApi, "export async function deleteInboundItem", "Inbound API wrapper must include item delete.");
assertIncludes(outboundApi, "export async function updateOutboundItem", "Outbound API wrapper must include item update.");
assertIncludes(outboundApi, "export async function deleteOutboundItem", "Outbound API wrapper must include item delete.");

assertFile("features/settings/sales-channels/api.ts", "Sales channel settings API must exist.");
assertFile("features/settings/sales-channels/SalesChannelsSettingsPage.tsx", "Sales channel settings page must exist.");
assertFile("app/(console)/settings/sales-channels/page.tsx", "Sales channel settings route must exist.");
assertIncludes(settingsTabs, "/settings/sales-channels", "Settings tabs must link sales channel settings.");
assertIncludes(orderCreate, "listSalesChannels", "Outbound creation must use configured sales channels.");
assertIncludes(outboundDetail, "listSalesChannels", "Outbound edit must use configured sales channels.");

assertIncludes(inventoryTypes, "current_stock_qty", "Inventory transaction rows must expose current stock quantity.");
assertIncludes(inventoryPage, "Current Stock", "Inventory transactions must show current stock next to movement quantities.");

console.log("[ppt-contract] OK");
