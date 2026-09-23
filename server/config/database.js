const mysql = require("mysql2/promise");
const env = require("./env");

// Create a reusable MySQL connection pool
const pool = mysql.createPool({
  host: env.database.host,
  port: env.database.port,
  database: env.database.name,
  user: env.database.user,
  password: env.database.password,
  waitForConnections: env.database.waitForConnections,
  connectionLimit: env.database.connectionLimit,
  queueLimit: env.database.queueLimit,
  charset: "utf8mb4",
  dateStrings: true,
});

/**
 * Health check to verify database connectivity using SELECT 1
 * Returns an object with connection status and error message if failed
 */
pool.checkHealth = async () => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query("SELECT 1 AS health");
      return { connected: true, error: null };
    } finally {
      connection.release();
    }
  } catch (error) {
    return { connected: false, error: error.message };
  }
};

module.exports = pool;
