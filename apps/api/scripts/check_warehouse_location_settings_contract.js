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

assertIncludes(
  "apps/api/src/routes/warehouseLocations.js",
  "const locationSchema = z.object",
  "Warehouse location API validates writes"
);

assertMatches(
  "apps/api/src/routes/warehouseLocations.js",
  /router\.post\("\/",\s*validate\(locationSchema\)/,
  "Warehouse location API supports create"
);

assertMatches(
  "apps/api/src/routes/warehouseLocations.js",
  /router\.put\("\/:id",\s*validate\(locationSchema\)/,
  "Warehouse location API supports update"
);

assertIncludes(
  "apps/api/src/routes/warehouseLocations.js",
  'router.delete("/:id"',
  "Warehouse location API supports soft delete"
);

assertIncludes(
  "apps/api/src/routes/warehouseLocations.js",
  "Duplicate warehouse location code",
  "Warehouse location API reports duplicate codes clearly"
);

assertIncludes(
  "apps/web/features/settings/warehouses/types.ts",
  "export type WarehouseLocation",
  "Warehouse settings has a location type"
);

assertIncludes(
  "apps/web/features/settings/warehouses/api.ts",
  "listWarehouseLocations",
  "Warehouse settings API client can list locations"
);

assertIncludes(
  "apps/web/features/settings/warehouses/api.ts",
  "createWarehouseLocation",
  "Warehouse settings API client can create locations"
);

assertIncludes(
  "apps/web/features/settings/warehouses/api.ts",
  "updateWarehouseLocation",
  "Warehouse settings API client can update locations"
);

assertIncludes(
  "apps/web/features/settings/warehouses/api.ts",
  "deleteWarehouseLocation",
  "Warehouse settings API client can delete locations"
);

assertIncludes(
  "apps/web/features/settings/warehouses/WarehousesSettingsPage.tsx",
  "Location management",
  "Warehouse settings page exposes location management"
);

assertIncludes(
  "apps/web/features/settings/warehouses/WarehousesSettingsPage.tsx",
  "openCreateLocation",
  "Warehouse settings page can open location creation"
);

assertIncludes(
  "apps/web/features/settings/warehouses/WarehousesSettingsPage.tsx",
  "selectedWarehouse",
  "Warehouse settings page scopes locations to a selected warehouse"
);

console.log("warehouse-location-settings-contract-ok");
