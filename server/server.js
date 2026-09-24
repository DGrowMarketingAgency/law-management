const env = require("./config/env");
const db = require("./config/database");
const app = require("./app");

/**
 * Start the Express HTTP server and verify database connection
 */
async function startServer() {
  console.log("--------------------------------------------------");
  console.log("Legal Practice Management Platform - Server Startup");
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log("--------------------------------------------------");

  // Validate Environment Variables (Fail-Fast in Production)
  env.validateEnv();

  // Test Database Connection
  try {
    const dbStatus = await db.checkHealth();
    if (dbStatus.connected) {
      console.log(`[Database]: Successfully connected to MySQL at ${env.database.host}:${env.database.port}/${env.database.name}`);
      try {
        const { runBillingMigration } = require("./database/billing_migration");
        await runBillingMigration();
        const { runPaymentGatewayMigration } = require("./database/payment_gateway_migration");
        await runPaymentGatewayMigration();
        const { runWorkforceMigration } = require("./database/workforce_migration");
        await runWorkforceMigration();
        const runLegalDocumentMigration = require("./database/legal_document_migration");
        await runLegalDocumentMigration();
        const runEmailSecurityMigration = require("./database/email_security_migration");
        await runEmailSecurityMigration();
      } catch (migErr) {
        console.error("[Database Warning]: Migration failed:", migErr.message);
      }
    } else {
      console.warn(
        `[Database Warning]: Could not establish initial connection to MySQL (${dbStatus.error}).`
      );
      console.warn(
        `[Database Warning]: Server will still start. Please ensure MySQL is running with database '${env.database.name}' configured.`
      );
    }
  } catch (dbError) {
    console.warn(`[Database Warning]: Database connection test failed: ${dbError.message}`);
  }

  // Start HTTP Server
  const server = app.listen(env.PORT, () => {
    console.log(`[Server]: REST API running on http://localhost:${env.PORT}/api/v1`);
    console.log(`[Server]: Health check available at http://localhost:${env.PORT}/api/v1/health`);
    console.log(`[Server]: Allowed Client Origin: ${env.clientUrl}`);
    console.log("--------------------------------------------------");

    // Start background WhatsApp Hearing Reminder Scheduler
    try {
      const hearingReminderScheduler = require("./services/whatsapp/hearingReminderScheduler");
      hearingReminderScheduler.start();
    } catch (schedErr) {
      console.error("[HearingReminderScheduler]: Failed to initialize:", schedErr.message);
    }
  });

  // Handle Unhandled Promise Rejections & Uncaught Exceptions
  process.on("unhandledRejection", (reason, promise) => {
    console.error("[Unhandled Rejection]:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("[Uncaught Exception]:", error);
    process.exit(1);
  });

  // Graceful Shutdown
  const handleShutdown = async (signal) => {
    console.log(`\n[Server]: Received ${signal}. Starting graceful shutdown...`);
    try {
      const hearingReminderScheduler = require("./services/whatsapp/hearingReminderScheduler");
      hearingReminderScheduler.stop();
    } catch (_) {}

    server.close(async () => {
      console.log("[Server]: HTTP server closed.");
      try {
        await db.end();
        console.log("[Database]: MySQL connection pool closed.");
      } catch (err) {
        console.error("[Database]: Error closing connection pool:", err.message);
      }
      process.exit(0);
    });
  };

  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
}

startServer().catch((err) => {
  console.error("[Fatal Startup Error]: Failed to start server:", err);
  process.exit(1);
});
