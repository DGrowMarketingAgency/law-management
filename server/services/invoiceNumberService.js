const db = require("../config/database");

/**
 * Invoice & Receipt Number Generation Service
 * Thread-safe, database-locked sequential numbering generator with
 * process-level high-water mark synchronization.
 *
 * Formats:
 * - Invoice: INV-YYYY-XXXXXX (e.g. INV-2026-000001)
 * - Receipt: REC-YYYY-XXXXXX (e.g. REC-2026-000001)
 * - Draft: DRAFT-YYYY-XXXXXX or DRAFT-TIMESTAMP
 */

const inMemorySeq = {
  invoice: {},
  receipt: {},
};

/**
 * Generate a sequential, unique official Invoice Number
 * Uses active transaction connection with row lock to prevent race conditions,
 * plus process-level monotonic incrementation.
 * @param {import('mysql2/promise').Connection|number} [conn]
 * @param {number} [year]
 * @returns {Promise<string>}
 */
const generateInvoiceNumber = async (conn = null, year = new Date().getFullYear()) => {
  let executor = conn;
  let targetYear = year;

  if (!conn || typeof conn === "number") {
    targetYear = typeof conn === "number" ? conn : new Date().getFullYear();
    executor = db;
  }

  const prefix = `INV-${targetYear}-`;

  // Query highest sequence number for this year under lock
  const [rows] = await executor.query(
    `SELECT invoice_number FROM invoices 
     WHERE invoice_number LIKE ? 
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [`${prefix}%`]
  );

  let lastDbSequence = 0;
  if (rows.length > 0 && rows[0].invoice_number) {
    const lastNumber = rows[0].invoice_number;
    const parts = lastNumber.split("-");
    if (parts.length >= 3) {
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq)) {
        lastDbSequence = seq;
      }
    }
  }

  const lastMemSequence = inMemorySeq.invoice[targetYear] || 0;
  const nextSequence = Math.max(lastDbSequence, lastMemSequence) + 1;
  inMemorySeq.invoice[targetYear] = nextSequence;

  const padded = String(nextSequence).padStart(6, "0");
  return `${prefix}${padded}`;
};

/**
 * Generate a temporary Draft Invoice Identifier
 * @param {number} [year]
 * @returns {string}
 */
const generateDraftInvoiceNumber = (year = new Date().getFullYear()) => {
  const timestamp = Date.now().toString().slice(-6);
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `DRAFT-${year}-${timestamp}${randomSuffix}`;
};

/**
 * Generate a sequential, unique official Receipt Number
 * @param {import('mysql2/promise').Connection|number} [conn]
 * @param {number} [year]
 * @returns {Promise<string>}
 */
const generateReceiptNumber = async (conn = null, year = new Date().getFullYear()) => {
  let executor = conn;
  let targetYear = year;

  if (!conn || typeof conn === "number") {
    targetYear = typeof conn === "number" ? conn : new Date().getFullYear();
    executor = db;
  }

  const prefix = `REC-${targetYear}-`;

  // Query highest sequence number for this year under lock
  const [rows] = await executor.query(
    `SELECT receipt_number FROM payments 
     WHERE receipt_number LIKE ? 
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [`${prefix}%`]
  );

  let lastDbSequence = 0;
  if (rows.length > 0 && rows[0].receipt_number) {
    const lastNumber = rows[0].receipt_number;
    const parts = lastNumber.split("-");
    if (parts.length >= 3) {
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq)) {
        lastDbSequence = seq;
      }
    }
  }

  const lastMemSequence = inMemorySeq.receipt[targetYear] || 0;
  const nextSequence = Math.max(lastDbSequence, lastMemSequence) + 1;
  inMemorySeq.receipt[targetYear] = nextSequence;

  const padded = String(nextSequence).padStart(6, "0");
  return `${prefix}${padded}`;
};

module.exports = {
  generateInvoiceNumber,
  generateDraftInvoiceNumber,
  generateReceiptNumber,
};
