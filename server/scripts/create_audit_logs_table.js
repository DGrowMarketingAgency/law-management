const db = require('../config/database');

async function ensureAuditLogsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        details JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_al_action (action),
        INDEX idx_al_entity (entity_type, entity_id),
        INDEX idx_al_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration] audit_logs table ready.');
    process.exit(0);
  } catch (err) {
    console.error('[Migration Error]:', err.message);
    process.exit(1);
  }
}

ensureAuditLogsTable();
