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
  !billingEngineSource.includes("DejaVuSans.ttf") && !billingEngineSource.includes("arial.ttf"),
  "PDF font lookup must not treat Latin-only fallback fonts as CJK-capable invoice fonts."
);

console.log("invoice-pdf-font-contract-ok");
