const { getPool } = require("../db");

async function ensureConfiguredAdminUser() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!email || !password) {
    return { configured: false, reason: "missing ADMIN_EMAIL or ADMIN_PASSWORD" };
  }

  const [rows] = await getPool().query(
    `SELECT id
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  if (rows.length > 0) {
    await getPool().query(
      `UPDATE users
       SET password_hash = ?,
           role = 'admin',
           status = 'active',
           deleted_at = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [password, Number(rows[0].id)]
    );

    return { configured: true, action: "updated", email };
  }

  await getPool().query(
    `INSERT INTO users (client_id, email, password_hash, name, role, status, created_at, updated_at, deleted_at)
     VALUES (NULL, ?, ?, 'Configured Admin', 'admin', 'active', NOW(), NOW(), NULL)`,
    [email, password]
  );

  return { configured: true, action: "created", email };
}

module.exports = {
  ensureConfiguredAdminUser,
};
