-- ==============================================================================
-- PROMPT 7A: ENCRYPTED DOCUMENT VAULT & PASSWORD APPLOCK SCHEMA
-- ==============================================================================

USE legal_practice;

-- 1. User Vaults Table (Per-user Master Vault Key wrapped by KEK)
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

-- 2. Vault Sessions Table (Server-side hashed session tokens)
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

-- 3. Extend document_versions Table to Support Envelope Encryption
-- Using stored procedure to idempotently add columns if not already present
DROP PROCEDURE IF EXISTS upgrade_document_versions_for_vault;
DELIMITER //
CREATE PROCEDURE upgrade_document_versions_for_vault()
BEGIN
  -- encryption_algorithm
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions' AND COLUMN_NAME = 'encryption_algorithm'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN encryption_algorithm VARCHAR(50) NOT NULL DEFAULT 'aes-256-gcm';
  END IF;

  -- encryption_version
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions' AND COLUMN_NAME = 'encryption_version'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN encryption_version INT NOT NULL DEFAULT 1;
  END IF;

  -- encrypted_data_key
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions' AND COLUMN_NAME = 'encrypted_data_key'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN encrypted_data_key VARCHAR(500) NULL;
  END IF;

  -- data_key_iv
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions' AND COLUMN_NAME = 'data_key_iv'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN data_key_iv VARCHAR(64) NULL;
  END IF;

  -- data_key_auth_tag
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions' AND COLUMN_NAME = 'data_key_auth_tag'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN data_key_auth_tag VARCHAR(64) NULL;
  END IF;

  -- encrypted_file_size
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions' AND COLUMN_NAME = 'encrypted_file_size'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN encrypted_file_size BIGINT UNSIGNED NULL;
  END IF;

  -- encryption_status
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions' AND COLUMN_NAME = 'encryption_status'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN encryption_status ENUM('ENCRYPTED', 'UNENCRYPTED') NOT NULL DEFAULT 'ENCRYPTED';
  END IF;

  -- file_iv (for file AES-GCM)
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions' AND COLUMN_NAME = 'file_iv'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN file_iv VARCHAR(64) NULL;
  END IF;

  -- file_auth_tag (for file AES-GCM)
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions' AND COLUMN_NAME = 'file_auth_tag'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN file_auth_tag VARCHAR(64) NULL;
  END IF;
END //
DELIMITER ;

CALL upgrade_document_versions_for_vault();
DROP PROCEDURE IF EXISTS upgrade_document_versions_for_vault;

