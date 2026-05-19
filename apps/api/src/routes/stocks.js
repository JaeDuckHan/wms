const express = require("express");
const { getPool } = require("../db");
const { getScopedClientId } = require("../middleware/clientScope");

const router = express.Router();

router.get("/stock-balances", async (req, res) => {
  const { client_id, product_id, lot_id, warehouse_id, location_id } = req.query;

  try {
    const scopedClientId = getScopedClientId(req);
    let query = `SELECT id, client_id, product_id, lot_id, warehouse_id, location_id, available_qty, reserved_qty, created_at, updated_at
                 FROM stock_balances
                 WHERE deleted_at IS NULL`;
    const params = [];

    if (scopedClientId) {
      query += " AND client_id = ?";
      params.push(scopedClientId);
    } else if (client_id) {
      query += " AND client_id = ?";
      params.push(client_id);
    }
    if (product_id) {
      query += " AND product_id = ?";
      params.push(product_id);
    }
    if (lot_id) {
      query += " AND lot_id = ?";
      params.push(lot_id);
    }
    if (warehouse_id) {
      query += " AND warehouse_id = ?";
      params.push(warehouse_id);
    }
    if (location_id) {
      query += " AND location_id = ?";
      params.push(location_id);
    }

    query += " ORDER BY id DESC";
    const [rows] = await getPool().query(query, params);
    res.json({ ok: true, data: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

router.get("/stock-transactions", async (req, res) => {
  const { client_id, product_id, lot_id, warehouse_id, ref_type, ref_id, txn_type, date_from, date_to, q, limit, offset } = req.query;

  try {
    const scopedClientId = getScopedClientId(req);
    const searchTerm = String(q ?? "").trim();
    const search = searchTerm ? `%${searchTerm}%` : null;
    const requestedLimit = Number(limit ?? 100);
    const requestedOffset = Number(offset ?? 0);
    const boundedLimit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 200) : 100;
    const boundedOffset = Number.isInteger(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
    let query = `SELECT st.id, st.client_id, st.product_id, st.lot_id, st.warehouse_id, st.location_id,
                        st.txn_type, st.txn_date, st.qty_in, st.qty_out, st.ref_type, st.ref_id,
                        st.note, st.created_by, st.created_at, st.updated_at,
                        CASE
                          WHEN st.ref_type = 'inbound_item' THEN io.inbound_no
                          WHEN st.ref_type = 'outbound_item' THEN oo.outbound_no
                          WHEN st.ref_type = 'return_item' THEN ro.return_no
                          ELSE NULL
                        END AS source_no
                 FROM stock_transactions st
                 LEFT JOIN clients c
                   ON c.id = st.client_id
                  AND c.deleted_at IS NULL
                 LEFT JOIN products p
                   ON p.id = st.product_id
                  AND p.deleted_at IS NULL
                 LEFT JOIN product_lots pl
                   ON pl.id = st.lot_id
                  AND pl.deleted_at IS NULL
                 LEFT JOIN inbound_items ii
                   ON st.ref_type = 'inbound_item'
                  AND st.ref_id = ii.id
                  AND ii.deleted_at IS NULL
                 LEFT JOIN inbound_orders io
                   ON ii.inbound_order_id = io.id
                  AND io.deleted_at IS NULL
                 LEFT JOIN outbound_items oi
                   ON st.ref_type = 'outbound_item'
                  AND st.ref_id = oi.id
                  AND oi.deleted_at IS NULL
                 LEFT JOIN outbound_orders oo
                   ON oi.outbound_order_id = oo.id
                  AND oo.deleted_at IS NULL
                 LEFT JOIN return_items ri
                   ON st.ref_type = 'return_item'
                  AND st.ref_id = ri.id
                  AND ri.deleted_at IS NULL
                 LEFT JOIN return_orders ro
                   ON ri.return_order_id = ro.id
                  AND ro.deleted_at IS NULL
                 WHERE st.deleted_at IS NULL`;
    const params = [];

    if (scopedClientId) {
      query += " AND st.client_id = ?";
      params.push(scopedClientId);
    } else if (client_id) {
      query += " AND st.client_id = ?";
      params.push(client_id);
    }
    if (product_id) {
      query += " AND st.product_id = ?";
      params.push(product_id);
    }
    if (lot_id) {
      query += " AND st.lot_id = ?";
      params.push(lot_id);
    }
    if (warehouse_id) {
      query += " AND st.warehouse_id = ?";
      params.push(warehouse_id);
    }
    if (ref_type) {
      query += " AND st.ref_type = ?";
      params.push(ref_type);
    }
    if (ref_id) {
      query += " AND st.ref_id = ?";
      params.push(ref_id);
    }
    if (txn_type) {
      query += " AND st.txn_type = ?";
      params.push(txn_type);
    }
    if (date_from) {
      query += " AND st.txn_date >= ?";
      params.push(date_from);
    }
    if (date_to) {
      query += " AND st.txn_date < DATE_ADD(?, INTERVAL 1 DAY)";
      params.push(date_to);
    }
    if (search) {
      query += ` AND (
        st.txn_type LIKE ?
        OR st.ref_type LIKE ?
        OR CAST(st.ref_id AS CHAR) LIKE ?
        OR st.note LIKE ?
        OR c.client_code LIKE ?
        OR c.name_kr LIKE ?
        OR c.name_en LIKE ?
        OR p.barcode_full LIKE ?
        OR p.barcode_raw LIKE ?
        OR p.name_kr LIKE ?
        OR p.name_en LIKE ?
        OR pl.lot_no LIKE ?
        OR io.inbound_no LIKE ?
        OR oo.outbound_no LIKE ?
        OR ro.return_no LIKE ?
      )`;
      params.push(
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search,
        search
      );
    }

    query += " ORDER BY st.txn_date DESC, st.id DESC LIMIT ? OFFSET ?";
    params.push(boundedLimit, boundedOffset);
    const [rows] = await getPool().query(query, params);
    res.json({ ok: true, data: rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
