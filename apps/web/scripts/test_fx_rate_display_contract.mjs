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

const apiBilling = read("../api/src/routes/billingEngine.js");
const formatSource = read("features/billing/format.ts");
const invoiceDetail = read("features/billing/InvoiceDetailPage.tsx");
const invoicesPage = read("features/billing/BillingInvoicesPage.tsx");
const eventsPage = read("features/billing/BillingEventsPage.tsx");
const exchangeRatesPage = read("features/settings/billing/ExchangeRatesSettingsPage.tsx");

assertIncludes(
  apiBilling,
  "function formatThbKrwRate",
  "API invoice export must format THB/KRW rates as a readable exchange-rate sentence."
);
assertIncludes(
  apiBilling,
  "formatThbKrwRate(invoice.fx_rate_thbkrw)",
  "PDF/HTML invoice summaries must use the readable exchange-rate formatter."
);
assertNotIncludes(
  apiBilling,
  '["FX THB/KRW", formatNumber(invoice.fx_rate_thbkrw, 4)]',
  "PDF invoice summary must not expose raw FX THB/KRW 4-decimal notation."
);
assertNotIncludes(
  apiBilling,
  '<span>FX THB/KRW</span><strong>${formatNumber(invoice.fx_rate_thbkrw, 4)}</strong>',
  "HTML invoice summary must not expose raw FX THB/KRW 4-decimal notation."
);

assertIncludes(
  formatSource,
  "export function formatThbKrwRate",
  "Web billing surfaces must share one THB/KRW display formatter."
);
assertIncludes(formatSource, "1 THB =", "The FX formatter must make the base currency explicit.");
assertIncludes(formatSource, "KRW", "The FX formatter must make the quote currency explicit.");

assertIncludes(
  invoiceDetail,
  "formatThbKrwRate(invoice.fx_rate_thbkrw)",
  "Invoice detail must display FX as 1 THB = N KRW."
);
assertNotIncludes(
  invoiceDetail,
  "Number(invoice.fx_rate_thbkrw).toFixed(4)",
  "Invoice detail must not display raw 4-decimal FX."
);

assertIncludes(invoicesPage, "formatThbKrwRate(row.fx_rate_thbkrw)", "Invoice list must display readable FX.");
assertNotIncludes(invoicesPage, "Number(row.fx_rate_thbkrw).toFixed(4)", "Invoice list must not display raw 4-decimal FX.");

assertIncludes(eventsPage, "formatThbKrwRate(row.fx_rate_thbkrw)", "Billing events must display readable FX.");
assertNotIncludes(eventsPage, "Number(row.fx_rate_thbkrw).toFixed(4)", "Billing events must not display raw 4-decimal FX.");

assertIncludes(exchangeRatesPage, "formatThbKrwRate(row.rate, 4)", "Exchange-rate settings must show unit context while preserving configured precision.");
assertNotIncludes(exchangeRatesPage, "Number(row.rate).toFixed(4)", "Exchange-rate settings must not display a bare 4-decimal rate.");

console.log("[fx-rate-display-contract] OK");
