import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const UPDATE = process.argv.includes("--update");
const SNAPSHOT_PATH = path.join(ROOT, "scripts", "snapshots", "detail-i18n.snapshot.json");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseConstObject(filePath, regex) {
  const source = read(filePath);
  const match = source.match(regex);
  if (!match) {
    throw new Error(`Failed to parse object from ${filePath}`);
  }
  return vm.runInNewContext(`(${match[1]})`);
}

function getByPath(source, dottedPath) {
  return dottedPath.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) return acc[key];
    return undefined;
  }, source);
}

const messagesKo = parseConstObject(
  path.join(ROOT, "lib", "i18n", "messages.ko.ts"),
  /export const messagesKo\s*=\s*({[\s\S]*?})\s*as const;/
);
const messagesEn = parseConstObject(
  path.join(ROOT, "lib", "i18n", "messages.en.ts"),
  /export const messagesEn\s*=\s*({[\s\S]*?})\s*as const;/
);
const koByEn = parseConstObject(
  path.join(ROOT, "lib", "i18n.ts"),
  /const koByEn:\s*Record<string,\s*string>\s*=\s*({[\s\S]*?});/
);
const enByKo = Object.entries(koByEn).reduce((acc, [en, ko]) => {
  if (!(ko in acc)) acc[ko] = en;
  return acc;
}, {});

function translateUiText(text, locale) {
  if (locale === "ko") return koByEn[text] ?? text;
  return enByKo[text] ?? text;
}

function t(locale, token) {
  const msg = locale === "ko" ? messagesKo : messagesEn;
  const value = getByPath(msg, token);
  if (typeof value === "string") return value;
  return translateUiText(token, locale);
}

const outboundFixture = {
  summary: "요약",
  memo: "메모",
  timeline: [{ title: "오더 상태가 변경되었습니다:", note: "저장 실패" }],
};
const inboundFixture = {
  summary: "요약",
  memo: "메모",
  timeline: [{ title: "입고 상태가 변경되었습니다:", note: "저장 실패" }],
};

function render(locale) {
  return {
    navInbounds: t(locale, "nav.inbounds"),
    outboundSummary: t(locale, outboundFixture.summary),
    outboundMemo: t(locale, outboundFixture.memo),
    outboundTimelineTitle: t(locale, outboundFixture.timeline[0].title),
    outboundTimelineNote: t(locale, outboundFixture.timeline[0].note),
    inboundSummary: t(locale, inboundFixture.summary),
    inboundMemo: t(locale, inboundFixture.memo),
    inboundTimelineTitle: t(locale, inboundFixture.timeline[0].title),
    inboundTimelineNote: t(locale, inboundFixture.timeline[0].note),
  };
}

const actual = {
  ko: render("ko"),
  en: render("en"),
};

const serialized = `${JSON.stringify(actual, null, 2)}\n`;

if (UPDATE || !fs.existsSync(SNAPSHOT_PATH)) {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, serialized, "utf8");
  console.log(`[snapshot] updated ${path.relative(ROOT, SNAPSHOT_PATH).replaceAll("\\", "/")}`);
  process.exit(0);
}

const expected = read(SNAPSHOT_PATH);
if (expected !== serialized) {
  console.error("[snapshot] FAILED: detail i18n snapshot mismatch");
  console.error("Run `npm run test:snapshot:detail-i18n:update` to update the snapshot.");
  process.exit(1);
}

console.log("[snapshot] OK: detail i18n snapshot");
