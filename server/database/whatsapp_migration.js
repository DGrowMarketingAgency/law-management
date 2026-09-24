const db = require("../config/database");

async function runWhatsAppMigration() {
  console.log("Verifying WhatsApp and Hearing Reminders schema...");

  // 1. whatsapp_hearing_reminder_settings
  await db.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_hearing_reminder_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reminder_type VARCHAR(50) NOT NULL UNIQUE,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      offset_days INT NOT NULL,
      send_time VARCHAR(10) NOT NULL DEFAULT '09:00',
      template_key VARCHAR(100) NOT NULL DEFAULT 'case_hearing_reminder',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Seed default settings if empty
  const [existingSettings] = await db.query(`SELECT COUNT(*) as cnt FROM whatsapp_hearing_reminder_settings`);
  if (existingSettings[0].cnt === 0) {
    await db.query(`
      INSERT INTO whatsapp_hearing_reminder_settings (reminder_type, enabled, offset_days, send_time, template_key)
      VALUES 
        ('HEARING_7_DAYS', 1, 7, '09:00', 'case_hearing_reminder_7d'),
        ('HEARING_1_DAY', 1, 1, '18:00', 'case_hearing_reminder_1d'),
        ('HEARING_TODAY', 1, 0, '08:00', 'case_hearing_reminder_today')
      ON DUPLICATE KEY UPDATE enabled = VALUES(enabled);
    `);
    console.log("  ✓ Seeded default WhatsApp hearing reminder settings.");
  }

  // 2. hearing_reminders
  await db.query(`
    CREATE TABLE IF NOT EXISTS hearing_reminders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hearing_id INT NOT NULL,
      case_id INT NOT NULL,
      client_id INT NOT NULL,
      reminder_type VARCHAR(50) NOT NULL,
      scheduled_at DATETIME NOT NULL,
      status ENUM('SCHEDULED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
      whatsapp_number VARCHAR(30) NULL,
      template_key VARCHAR(100) NULL,
      provider_message_id VARCHAR(100) NULL,
      failure_reason TEXT NULL,
      source VARCHAR(50) NOT NULL DEFAULT 'AUTO',
      retry_count INT NOT NULL DEFAULT 0,
      sent_at DATETIME NULL,
      delivered_at DATETIME NULL,
      read_at DATETIME NULL,
      failed_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_hr_hearing_client_type (hearing_id, client_id, reminder_type),
      INDEX idx_hr_status (status),
      INDEX idx_hr_scheduled (scheduled_at),
      INDEX idx_hr_client (client_id),
      INDEX idx_hr_case (case_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("  ✓ Verified hearing_reminders table.");

  // 3. whatsapp_message_logs
  await db.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hearing_reminder_id INT NULL,
      client_id INT NULL,
      phone_number VARCHAR(30) NOT NULL,
      template_key VARCHAR(100) NOT NULL,
      provider_message_id VARCHAR(100) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'SENT',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      delivered_at DATETIME NULL,
      read_at DATETIME NULL,
      failed_at DATETIME NULL,
      error_message TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_wml_reminder (hearing_reminder_id),
      INDEX idx_wml_provider_msg (provider_message_id),
      INDEX idx_wml_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("  ✓ Verified whatsapp_message_logs table.");

  console.log("✓ WhatsApp migration completed successfully.");
}

if (require.main === module) {
  runWhatsAppMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration error:", err);
      process.exit(1);
    });
}

module.exports = { runWhatsAppMigration };
