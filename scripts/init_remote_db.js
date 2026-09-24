const fs = require("fs");
const path = require("path");
const mysql = require("../server/node_modules/mysql2/promise");
const env = require("../server/config/env");

async function executeSqlFile(conn, filePath) {
  console.log(`Executing SQL file: ${path.basename(filePath)}...`);
  let content = fs.readFileSync(filePath, "utf8");

  // Remove CREATE DATABASE ... ; (multiline)
  content = content.replace(/CREATE\s+DATABASE[^;]+;/gis, "");
  // Remove USE ... ;
  content = content.replace(/USE\s+`?[a-zA-Z0-9_]+`?;/gis, "");

  // Execute using multiple statements
  await conn.query(content);
  console.log(`✓ Completed: ${path.basename(filePath)}`);
}

async function run() {
  let conn;
  try {
    console.log("Connecting to database:", env.database.name, "at", env.database.host);
    conn = await mysql.createConnection({
      host: env.database.host,
      port: env.database.port,
      user: env.database.user,
      password: env.database.password,
      database: env.database.name,
      multipleStatements: true,
    });

    const baseSqlFiles = [
      path.resolve(__dirname, "../database/schema.sql"),
      path.resolve(__dirname, "../database/seed.sql"),
      path.resolve(__dirname, "../database/crm_schema.sql"),
      path.resolve(__dirname, "../database/case_schema.sql"),
      path.resolve(__dirname, "../database/deadline_schema.sql"),
      path.resolve(__dirname, "../server/database/vault_schema.sql"),
      path.resolve(__dirname, "../server/database/document_schema.sql"),
      path.resolve(__dirname, "../server/database/billing_schema.sql"),
    ];

    for (const file of baseSqlFiles) {
      if (fs.existsSync(file)) {
        await executeSqlFile(conn, file);
      }
    }

    // Run programmatic migrations
    console.log("Running migration modules...");
    try {
      const { runBillingMigration } = require("../server/database/billing_migration");
      await runBillingMigration();
    } catch (e) {
      console.warn("Billing migration notice:", e.message);
    }

    try {
      const { runPaymentGatewayMigration } = require("../server/database/payment_gateway_migration");
      await runPaymentGatewayMigration();
    } catch (e) {
      console.warn("Payment gateway migration notice:", e.message);
    }

    try {
      const { runWorkforceMigration } = require("../server/database/workforce_migration");
      await runWorkforceMigration();
    } catch (e) {
      console.warn("Workforce migration notice:", e.message);
    }

    try {
      const runLegalDocMigration = require("../server/database/legal_document_migration");
      await runLegalDocMigration();
    } catch (e) {
      console.warn("Legal document migration notice:", e.message);
    }

    try {
      const runEmailSecurity = require("../server/database/email_security_migration");
      if (typeof runEmailSecurity === "function") await runEmailSecurity();
      else if (runEmailSecurity.runMigration) await runEmailSecurity.runMigration();
    } catch (e) {
      console.warn("Email security notice:", e.message);
    }

    // Verify tables
    const [tables] = await db.query("SHOW TABLES");
    console.log(`\n🎉 Total Tables created: ${tables.length}`);

    // Check users count
    const [users] = await db.query("SELECT COUNT(*) as count FROM users");
    console.log(`Current users count: ${users[0].count}`);

    console.log("\nSetup status is ready: First Owner Setup is ACTIVE!");
    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

run();
