const http = require("node:http");
const { startServer } = require("../src/server");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3100";
const TIMEOUT_MS = 20000;
const POLL_MS = 500;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/health`, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Unexpected status: ${res.statusCode}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.ok === true) {
            resolve(parsed);
            return;
          }
          reject(new Error(`Unexpected body: ${data}`));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
  });
}

async function main() {
  const server = startServer(undefined, { startScheduler: false });
  const startedAt = Date.now();
  let passed = false;
  try {
    while (Date.now() - startedAt < TIMEOUT_MS) {
      try {
        const health = await requestHealth();
        console.log(`[e2e:health-smoke] OK ${JSON.stringify(health)}`);
        passed = true;
        break;
      } catch {
        await wait(POLL_MS);
      }
    }
    if (!passed) {
      throw new Error(`Health endpoint did not become ready within ${TIMEOUT_MS}ms`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(`[e2e:health-smoke] FAILED: ${error.message}`);
  process.exit(1);
});
