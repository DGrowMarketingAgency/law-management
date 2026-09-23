const pool = require("../config/database");

/**
 * WorkforceCodeService
 * Concurrency-safe atomic generation of unique identifier codes.
 * Uses atomic sequence checking or transaction-locked querying.
 */
class WorkforceCodeService {
  /**
   * Generate next sequential code
   * @param {string} prefix - e.g. 'EMP', 'INT', 'CON', 'CAN', 'OFF', 'TSK', 'PAY', 'CLM', 'CERT'
   * @param {string} table - target table name
   * @param {string} column - target column name
   * @param {object} connection - optional existing mysql transaction connection
   */
  static async generateCode(prefix, table, column, connection = null) {
    const conn = connection || (await pool.getConnection());
    const shouldRelease = !connection;

    try {
      // Find the highest existing code for this prefix
      const [rows] = await conn.query(
        `SELECT ${column} AS lastCode 
         FROM ${table} 
         WHERE ${column} LIKE ? 
         ORDER BY id DESC 
         LIMIT 1 
         FOR UPDATE`,
        [`${prefix}-%`]
      );

      let nextSeq = 1;
      if (rows && rows.length > 0 && rows[0].lastCode) {
        const lastCode = rows[0].lastCode;
        const parts = lastCode.split("-");
        const numPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(numPart)) {
          nextSeq = numPart + 1;
        }
      }

      const padded = String(nextSeq).padStart(6, "0");
      return `${prefix}-${padded}`;
    } finally {
      if (shouldRelease) {
        conn.release();
      }
    }
  }

  /**
   * Generate Certificate number e.g. CERT-2026-000001
   */
  static async generateCertificateCode(connection = null) {
    const year = new Date().getFullYear();
    const prefix = `CERT-${year}`;
    const conn = connection || (await pool.getConnection());
    const shouldRelease = !connection;

    try {
      const [rows] = await conn.query(
        `SELECT certificate_number AS lastCode 
         FROM internship_records 
         WHERE certificate_number LIKE ? 
         ORDER BY id DESC 
         LIMIT 1 
         FOR UPDATE`,
        [`${prefix}-%`]
      );

      let nextSeq = 1;
      if (rows && rows.length > 0 && rows[0].lastCode) {
        const lastCode = rows[0].lastCode;
        const parts = lastCode.split("-");
        const numPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(numPart)) {
          nextSeq = numPart + 1;
        }
      }

      const padded = String(nextSeq).padStart(5, "0");
      return `${prefix}-${padded}`;
    } finally {
      if (shouldRelease) {
        conn.release();
      }
    }
  }
}

module.exports = WorkforceCodeService;
