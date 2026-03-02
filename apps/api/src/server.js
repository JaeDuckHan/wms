const express = require("express");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");
const { pingDb, getBillingSchemaReadiness } = require("./db");
const { authenticateToken } = require("./middleware/auth");
const { enforceWriteAccess } = require("./middleware/rbac");
const authRouter = require("./routes/auth");
const productsRouter = require("./routes/products");
const productLotsRouter = require("./routes/productLots");
const warehousesRouter = require("./routes/warehouses");
const clientsRouter = require("./routes/clients");
const inboundOrdersRouter = require("./routes/inboundOrders");
const inboundItemsRouter = require("./routes/inboundItems");
const outboundOrdersRouter = require("./routes/outboundOrders");
const outboundItemsRouter = require("./routes/outboundItems");
const outboundBoxesRouter = require("./routes/outboundBoxes");
const returnOrdersRouter = require("./routes/returnOrders");
const returnItemsRouter = require("./routes/returnItems");
const stocksRouter = require("./routes/stocks");
const serviceEventsRouter = require("./routes/serviceEvents");
const settlementsRouter = require("./routes/settlements");
const billingEngineRouter = require("./routes/billingEngine");
const { router: dashboardRouter } = require("./routes/dashboard");
const { startStorageSnapshotSchedule } = require("./jobs/storageSnapshots");
const openapi = require("./openapi.json");

dotenv.config();

function isPublicPath(pathname) {
  return (
    pathname === "/health" ||
    pathname === "/health/db" ||
    pathname === "/auth/login" ||
    pathname === "/auth/login/" ||
    pathname.startsWith("/docs")
  );
}


function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "wms-api"
    });
  });

  app.get("/health/db", async (_req, res) => {
    try {
      const [result, billingReadiness] = await Promise.all([
        pingDb(),
        getBillingSchemaReadiness()
      ]);

      const payload = {
        ok: billingReadiness.ready,
        db: result.db,
        serverTime: result.server_time,
        billing: billingReadiness
      };

      if (!billingReadiness.ready) {
        return res.status(503).json({
          ...payload,
          message: "Billing schema is not ready. Apply billing patches and restart."
        });
      }

      return res.json(payload);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: "Database connection failed",
        error: error.message
      });
    }
  });

  app.use((req, res, next) => {
    if (isPublicPath(req.path)) {
      return next();
    }
    return authenticateToken(req, res, next);
  });

  app.use((req, res, next) => {
    if (isPublicPath(req.path)) {
      return next();
    }
    return enforceWriteAccess(req, res, next);
  });

  app.use("/products", productsRouter);
  app.use("/product-lots", productLotsRouter);
  app.use("/warehouses", warehousesRouter);
  app.use("/clients", clientsRouter);
  app.use("/inbound-orders", inboundOrdersRouter);
  app.use("/inbound-items", inboundItemsRouter);
  app.use("/outbound-orders", outboundOrdersRouter);
  app.use("/outbound-orders", outboundBoxesRouter);
  app.use("/outbound-items", outboundItemsRouter);
  app.use("/return-orders", returnOrdersRouter);
  app.use("/return-items", returnItemsRouter);
  app.use("/", stocksRouter);
  app.use("/", serviceEventsRouter);
  app.use("/", settlementsRouter);
  app.use("/", billingEngineRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  app.use((_req, res) => {
    res.status(404).json({
      ok: false,
      code: "NOT_FOUND",
      message: "Route not found"
    });
  });

  app.use((error, _req, res, _next) => {
    res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      message: error.message || "Internal server error"
    });
  });

  return app;
}

function startServer(port = Number(process.env.PORT || 3100), options = {}) {
  const {
    startScheduler = true,
    billingSchemaGuardMode = process.env.BILLING_SCHEMA_GUARD_MODE || (process.env.NODE_ENV === "production" ? "strict" : "warn")
  } = options;
  const app = createApp();
  const server = app.listen(port, () => {
    if (startScheduler) {
      startStorageSnapshotSchedule();
    }
    console.log(`wms-api listening on http://localhost:${port}`);
    void (async () => {
      try {
        const readiness = await getBillingSchemaReadiness();
        if (readiness.ready) {
          console.log("[schema-guard] billing schema ready");
          return;
        }

        const missing = readiness.missing_tables.join(", ");
        console.error(`[schema-guard] missing billing tables: ${missing}`);
        console.error("[schema-guard] apply patches:");
        console.error("  1) apps/api/sql/patch_billing_invoice_engine.sql");
        console.error("  2) apps/api/sql/patch_multi_warehouse_billing_storage.sql");

        if (billingSchemaGuardMode === "strict") {
          console.error("[schema-guard] strict mode enabled, shutting down API.");
          server.close(() => {
            if (require.main === module) {
              process.exit(1);
            }
          });
        }
      } catch (error) {
        console.error(`[schema-guard] check failed: ${error.message}`);
      }
    })();
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer
};
