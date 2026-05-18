const express = require("express");
const { z } = require("zod");
const { getPool } = require("../db");
const { validate } = require("../middleware/validate");

const router = express.Router();

const locationSchema = z.object({
  warehouse_id: z.coerce.number().int().positive(),
  location_code: z.string().min(1).max(100),
  zone: z.string().max(100).nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

function normalizeLocationPayload(body) {
  return {
    warehouse_id: Number(body.warehouse_id),
    location_code: String(body.location_code || "").trim().toUpperCase(),
    zone: body.zone == null || String(body.zone).trim() === "" ? null : String(body.zone).trim(),
    status: body.status || "active",
  };
}

function isMysqlDuplicate(error) {
  return error && error.code === "ER_DUP_ENTRY";
}

function isMysqlForeignKeyMissing(error) {
  return error && (error.code === "ER_NO_REFERENCED_ROW_2" || error.errno === 1452);
}

async function selectLocationById(id) {
  const [rows] = await getPool().query(
    `SELECT id, warehouse_id, location_code, zone, status, created_at, updated_at
     FROM warehouse_locations
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
}

async function selectAnyLocationByWarehouseAndCode(warehouseId, locationCode) {
  const [rows] = await getPool().query(
    `SELECT id, warehouse_id, location_code, zone, status, deleted_at, created_at, updated_at
     FROM warehouse_locations
     WHERE warehouse_id = ? AND location_code = ?
     LIMIT 1`,
    [warehouseId, locationCode]
  );
  return rows[0] || null;
}

router.get("/", async (req, res) => {
  const { warehouse_id, status } = req.query;

  try {
    let query = `SELECT id, warehouse_id, location_code, zone, status, created_at, updated_at
                 FROM warehouse_locations
                 WHERE deleted_at IS NULL`;
    const params = [];

    if (warehouse_id) {
      query += " AND warehouse_id = ?";
      params.push(warehouse_id);
    }

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY warehouse_id ASC, location_code ASC, id ASC";

    const [rows] = await getPool().query(query, params);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.post("/", validate(locationSchema), async (req, res) => {
  const payload = normalizeLocationPayload(req.body);

  if (!payload.location_code) {
    return res.status(400).json({ ok: false, message: "location_code is required" });
  }

  try {
    const [result] = await getPool().query(
      `INSERT INTO warehouse_locations (warehouse_id, location_code, zone, status)
       VALUES (?, ?, ?, ?)`,
      [payload.warehouse_id, payload.location_code, payload.zone, payload.status]
    );

    const created = await selectLocationById(result.insertId);
    return res.status(201).json({ ok: true, data: created });
  } catch (error) {
    if (isMysqlDuplicate(error)) {
      const existing = await selectAnyLocationByWarehouseAndCode(payload.warehouse_id, payload.location_code);
      if (existing && existing.deleted_at) {
        await getPool().query(
          `UPDATE warehouse_locations
           SET zone = ?, status = ?, deleted_at = NULL
           WHERE id = ?`,
          [payload.zone, payload.status, existing.id]
        );
        const reactivated = await selectLocationById(existing.id);
        return res.status(201).json({ ok: true, data: reactivated });
      }
      return res.status(409).json({ ok: false, message: "Duplicate warehouse location code" });
    }
    if (isMysqlForeignKeyMissing(error)) {
      return res.status(400).json({ ok: false, message: "Invalid warehouse_id" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.put("/:id", validate(locationSchema), async (req, res) => {
  const payload = normalizeLocationPayload(req.body);

  if (!payload.location_code) {
    return res.status(400).json({ ok: false, message: "location_code is required" });
  }

  try {
    const [result] = await getPool().query(
      `UPDATE warehouse_locations
       SET warehouse_id = ?, location_code = ?, zone = ?, status = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [payload.warehouse_id, payload.location_code, payload.zone, payload.status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Warehouse location not found" });
    }

    const updated = await selectLocationById(req.params.id);
    return res.json({ ok: true, data: updated });
  } catch (error) {
    if (isMysqlDuplicate(error)) {
      return res.status(409).json({ ok: false, message: "Duplicate warehouse location code" });
    }
    if (isMysqlForeignKeyMissing(error)) {
      return res.status(400).json({ ok: false, message: "Invalid warehouse_id" });
    }
    return res.status(500).json({ ok: false, message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const [result] = await getPool().query(
      "UPDATE warehouse_locations SET status = 'inactive', deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Warehouse location not found" });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
