import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const WEB_ROOT = ROOT;

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

function flattenMessagePaths(obj, prefix = "", out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out.add(next);
      continue;
    }
    if (value && typeof value === "object") {
      flattenMessagePaths(value, next, out);
    }
  }
  return out;
}

function collectFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(abs, out);
      continue;
    }
    if (abs.endsWith(".ts") || abs.endsWith(".tsx")) out.push(abs);
  }
  return out;
}

function hasPath(obj, dottedPath) {
  const value = dottedPath.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) return acc[key];
    return undefined;
  }, obj);
  return typeof value === "string";
}

const messagesKo = parseConstObject(
  path.join(WEB_ROOT, "lib", "i18n", "messages.ko.ts"),
  /export const messagesKo\s*=\s*({[\s\S]*?})\s*as const;/
);
const messagesEn = parseConstObject(
  path.join(WEB_ROOT, "lib", "i18n", "messages.en.ts"),
  /export const messagesEn\s*=\s*({[\s\S]*?})\s*as const;/
);
const koByEn = parseConstObject(
  path.join(WEB_ROOT, "lib", "i18n.ts"),
  /const koByEn:\s*Record<string,\s*string>\s*=\s*({[\s\S]*?});/
);

const koPaths = flattenMessagePaths(messagesKo);
const enPaths = flattenMessagePaths(messagesEn);

const missingInKo = [...enPaths].filter((p) => !koPaths.has(p));
const missingInEn = [...koPaths].filter((p) => !enPaths.has(p));

const filesToScan = [
  ...collectFiles(path.join(WEB_ROOT, "app")),
  ...collectFiles(path.join(WEB_ROOT, "components")),
  ...collectFiles(path.join(WEB_ROOT, "features")),
  ...collectFiles(path.join(WEB_ROOT, "lib")),
].filter((f) => !f.endsWith("messages.ko.ts") && !f.endsWith("messages.en.ts"));

const koValues = new Set(Object.values(koByEn));
const koKeys = new Set(Object.keys(koByEn));
const missingTokens = [];
const tokenRegex = /\bt\(\s*["']([^"'\r\n]+)["']\s*\)/g;

for (const filePath of filesToScan) {
  const rel = path.relative(WEB_ROOT, filePath).replaceAll("\\", "/");
  const source = read(filePath);
  for (const match of source.matchAll(tokenRegex)) {
    const token = match[1];
    const existsAsPath = hasPath(messagesKo, token) && hasPath(messagesEn, token);
    const existsAsText = koKeys.has(token) || koValues.has(token);
    if (!existsAsPath && !existsAsText) {
      missingTokens.push(`${rel}: ${token}`);
    }
  }
}

if (missingInKo.length || missingInEn.length || missingTokens.length) {
  console.error("[i18n:check] FAILED");
  if (missingInKo.length) {
    console.error("Paths missing in ko messages:");
    for (const p of missingInKo) console.error(`- ${p}`);
  }
  if (missingInEn.length) {
    console.error("Paths missing in en messages:");
    for (const p of missingInEn) console.error(`- ${p}`);
  }
  if (missingTokens.length) {
    console.error("Unknown t(...) tokens:");
    for (const row of missingTokens) console.error(`- ${row}`);
  }
  process.exit(1);
}

console.log(`[i18n:check] OK - ${koPaths.size} message keys, ${filesToScan.length} files scanned`);
