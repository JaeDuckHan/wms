const fs = require("fs");
const path = require("path");

const apiRoot = path.resolve(__dirname, "..");
const dockerfile = fs.readFileSync(path.join(apiRoot, "Dockerfile"), "utf8");
const billingEngineSource = fs.readFileSync(path.join(apiRoot, "src", "routes", "billingEngine.js"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  /apk\s+add\s+--no-cache[\s\S]*font-noto-cjk/.test(dockerfile),
  "API Docker image must install font-noto-cjk so invoice PDFs can render Korean customer names in production."
);

assert(
  billingEngineSource.includes("/usr/share/fonts/noto/NotoSansCJK-Regular.ttc"),
  "PDF font lookup must include Alpine font-noto-cjk's NotoSansCJK-Regular.ttc path."
);

assert(
  !/replace\(\s*\/\[\^\\x20-\\x7E\]\/g,\s*["']\?["']\s*\)/.test(billingEngineSource),
  "PDF generation must not silently replace non-ASCII invoice text with question marks."
);

assert(
  billingEngineSource.includes("PDF_CJK_FONT_MISSING"),
  "PDF generation must fail explicitly when Unicode invoice text is present but no CJK-capable font is available."
);

assert(
  billingEngineSource.includes("NotoSansCJKkr-Regular"),
  "PDF font lookup must select the Korean PostScript face when registering Noto Sans CJK TTC fonts."
);

assert(
  billingEngineSource.includes("PDF_FONT_POSTSCRIPT_NAME"),
  "PDF font lookup must allow a PostScript face override when PDF_FONT_PATH points to a TTC collection."
);

assert(
  /registerFont\(\s*fontName,\s*fontConfig\.path,\s*fontConfig\.postscriptName\s*\)/.test(billingEngineSource),
  "PDFKit must register TTC fonts with a PostScript face name; registering only the TTC file causes createSubset errors."
);

assert(
  !billingEngineSource.includes("DejaVuSans.ttf") && !billingEngineSource.includes("arial.ttf"),
  "PDF font lookup must not treat Latin-only fallback fonts as CJK-capable invoice fonts."
);

assert(
  billingEngineSource.includes("fitPdfTextFontSize"),
  "Invoice PDF generation must shrink long single-line identifiers to fit their box."
);

assert(
  /text\(text\(invoice\.invoice_no\),[\s\S]*lineBreak:\s*false/.test(billingEngineSource),
  "Invoice number must be rendered as a single line instead of wrapping at hyphens."
);

assert(
  /column\.kind === "code"[\s\S]*lineBreak:\s*false/.test(billingEngineSource),
  "Invoice item service codes must be rendered as single-line identifiers instead of wrapping."
);

console.log("invoice-pdf-font-contract-ok");
