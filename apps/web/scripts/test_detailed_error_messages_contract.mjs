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
  "apps/web/lib/api-error-message.ts",
  "formatApiErrorMessage",
  "Web has a shared API error formatter"
);

assertIncludes(
  "apps/web/lib/api-error-message.ts",
  "details",
  "API formatter keeps validation details"
);

assertIncludes(
  "apps/web/features/settings/shared/http.ts",
  "formatApiErrorMessage(json)",
  "Settings and product requests use detailed API errors"
);

assertIncludes(
  "apps/web/features/inbound/api.ts",
  "formatApiErrorMessage(json)",
  "Inbound requests use detailed API errors"
);

assertIncludes(
  "apps/web/features/outbound/api.ts",
  "formatApiErrorMessage(json)",
  "Outbound requests use detailed API errors"
);

assertMatches(
  "apps/api/src/middleware/validate.js",
  /message:\s*formatValidationMessage\(parsed\.error\.issues\)/,
  "API validation responses expose field-level messages"
);

assertIncludes(
  "apps/web/features/operations/OrderCreateForm.tsx",
  "getErrorMessage(saveError)",
  "Inbound/outbound create form renders server error details"
);

assertIncludes(
  "apps/web/features/operations/OrderCreateForm.tsx",
  "applyApiValidationErrors(saveError)",
  "Order create form maps API validation details to item fields"
);

assertIncludes(
  "apps/web/features/operations/OrderCreateForm.tsx",
  "Item ${itemIndex + 1} / ${label}",
  "Order create form rewrites technical item paths into operator-friendly labels"
);

assertIncludes(
  "apps/web/features/settings/products/ProductsSettingsPage.tsx",
  "{fieldError &&",
  "Product settings form renders save error details inline"
);

console.log("detailed-error-messages-contract-ok");
