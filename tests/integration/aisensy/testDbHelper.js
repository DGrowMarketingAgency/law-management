const path = require("path");
module.paths.push(path.resolve(__dirname, "../../../server/node_modules"));

const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const TEST_DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: "legal_practice_test",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let testPool = null;

async function getTestPool() {
  if (testPool) return testPool;

  // 1. Ensure test database exists
  const adminConn = await mysql.createConnection({
    host: TEST_DB_CONFIG.host,
    port: TEST_DB_CONFIG.port,
    user: TEST_DB_CONFIG.user,
    password: TEST_DB_CONFIG.password,
  });

  await adminConn.query(`CREATE DATABASE IF NOT EXISTS legal_practice_test`);
  await adminConn.end();

  // 2. Clone schema from main DB if tables don't exist in legal_practice_test
  const testConn = await mysql.createConnection(TEST_DB_CONFIG);
  const tables = [
    "users",
    "roles",
    "permissions",
    "user_roles",
    "role_permissions",
    "contacts",
    "clients",
    "courts",
    "cases",
    "case_parties",
    "case_hearings",
    "hearing_reminders",
    "whatsapp_hearing_reminder_settings",
    "whatsapp_message_logs",
    "webhook_events",
    "audit_logs",
    "crm_audit_logs",
  ];

  for (const table of tables) {
    try {
      await testConn.query(
        `CREATE TABLE IF NOT EXISTS legal_practice_test.${table} LIKE legal_practice.${table}`
      );
    } catch (e) {
      // Ignore if table already exists
    }
  }

  // Ensure default court if courts empty
  const [courts] = await testConn.query(`SELECT id FROM courts LIMIT 1`);
  if (courts.length === 0) {
    await testConn.query(
      `INSERT INTO courts (id, name, court_type, city, state) VALUES (1, 'High Court of Delhi', 'HIGH_COURT', 'New Delhi', 'Delhi')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`
    );
  }

  // Ensure reminder settings cloned from main DB
  const [settings] = await testConn.query(`SELECT id FROM whatsapp_hearing_reminder_settings LIMIT 1`);
  if (settings.length === 0) {
    try {
      await testConn.query(`INSERT INTO legal_practice_test.whatsapp_hearing_reminder_settings SELECT * FROM legal_practice.whatsapp_hearing_reminder_settings`);
    } catch (e) {
      // Ignore if already copied
    }
  }

  await testConn.end();

  testPool = mysql.createPool(TEST_DB_CONFIG);
  return testPool;
}

async function closeTestPool() {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

module.exports = {
  getTestPool,
  closeTestPool,
  TEST_DB_CONFIG,
};
