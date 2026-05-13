const express = require("express");
const { getPool } = require("../db");

const router = express.Router();

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

module.exports = router;
