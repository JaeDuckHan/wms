import fs from "node:fs";
import path from "node:path";

const routePath = path.resolve("app/api/proxy/[...path]/route.ts");
const source = fs.readFileSync(routePath, "utf8");

if (!source.includes("content-disposition")) {
  throw new Error("Proxy must forward content-disposition for invoice downloads.");
}

if (!source.includes("response.headers.get(\"content-disposition\")")) {
  throw new Error("Proxy should copy content-disposition from the upstream API response.");
}

if (!source.includes("await response.arrayBuffer()")) {
  throw new Error("Proxy must preserve binary PDF bodies with arrayBuffer(), not text().");
}

if (!source.includes("isTextLikeResponse")) {
  throw new Error("Proxy must explicitly split text-like responses from binary responses.");
}
