const pool = require("../config/database");

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log("Starting Prompt 7A Vault Database Migration...");

    // 1. user_vaults
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_vaults (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        kdf_algorithm VARCHAR(50) NOT NULL DEFAULT 'scrypt',
        kdf_salt VARCHAR(128) NOT NULL,
        kdf_parameters JSON NOT NULL,
        encrypted_vault_key VARCHAR(500) NOT NULL,
        vault_key_iv VARCHAR(64) NOT NULL,
        vault_key_auth_tag VARCHAR(64) NOT NULL,
        failed_attempts INT NOT NULL DEFAULT 0,
        locked_until DATETIME NULL,
        last_unlocked_at DATETIME NULL,
        last_locked_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_user_vaults_user_id (user_id),
        CONSTRAINT fk_user_vaults_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ user_vaults table created/verified.");

    // 2. vault_sessions
    await conn.query(`
      CREATE TABLE IF NOT EXISTS vault_sessions (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        session_token_hash VARCHAR(64) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_vault_session_token_hash (session_token_hash),
        INDEX idx_vault_sessions_user (user_id),
        INDEX idx_vault_sessions_active (session_token_hash, revoked_at, expires_at),
        CONSTRAINT fk_vault_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ vault_sessions table created/verified.");

    // 3. Extend document_versions
    const [cols] = await conn.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions'
    `);
    const colNames = cols.map((c) => c.COLUMN_NAME);

    const additions = [
      {
        name: "encryption_algorithm",
        def: "VARCHAR(50) NOT NULL DEFAULT 'aes-256-gcm'",
      },
      { name: "encryption_version", def: "INT NOT NULL DEFAULT 1" },
      { name: "encrypted_data_key", def: "VARCHAR(500) NULL" },
      { name: "data_key_iv", def: "VARCHAR(64) NULL" },
      { name: "data_key_auth_tag", def: "VARCHAR(64) NULL" },
      { name: "encrypted_file_size", def: "BIGINT UNSIGNED NULL" },
      {
        name: "encryption_status",
        def: "ENUM('ENCRYPTED', 'UNENCRYPTED') NOT NULL DEFAULT 'ENCRYPTED'",
      },
      { name: "file_iv", def: "VARCHAR(64) NULL" },
      { name: "file_auth_tag", def: "VARCHAR(64) NULL" },
    ];

    for (const add of additions) {
      if (!colNames.includes(add.name)) {
        await conn.query(
          `ALTER TABLE document_versions ADD COLUMN ${add.name} ${add.def}`,
        );
        console.log(`✓ Added column ${add.name} to document_versions.`);
      } else {
        console.log(`- Column ${add.name} already exists.`);
      }
    }

    console.log("Prompt 7A Vault Database Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

migrate();
