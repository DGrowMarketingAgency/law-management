const db = require("../config/database");
const { getInvoiceById, getInvoices } = require("./invoiceService");
const { getPayments } = require("./paymentService");
const { roundDec2 } = require("./billingCalculationService");

/**
 * Resolve client_id from authenticated user
 * Strict derivation: Never trusts client_id from request body/query.
 * @param {number} userId
 * @returns {Promise<number>}
 */
const resolveClientIdFromUser = async (userOrId) => {
  const userId = typeof userOrId === "object" && userOrId !== null ? userOrId.id : userOrId;
  const userEmail = typeof userOrId === "object" && userOrId !== null ? userOrId.email : null;

  // 1. Direct user_id link on clients table
  const [directRows] = await db.execute(
    `SELECT id FROM clients WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1`,
    [userId]
  );

  if (directRows.length > 0) {
    return directRows[0].id;
  }

  // 2. Lookup via matching user email to contact email
  if (userEmail) {
    const [emailRows] = await db.execute(
      `SELECT cl.id
       FROM clients cl
       JOIN contacts cnt ON cl.contact_id = cnt.id
       WHERE LOWER(cnt.email) = LOWER(?) AND cl.status = 'ACTIVE' AND cnt.deleted_at IS NULL
       LIMIT 1`,
      [userEmail]
    );

    if (emailRows.length > 0) {
      return emailRows[0].id;
    }
  }

  const [fallbackRows] = await db.execute(
    `SELECT cl.id
     FROM clients cl
     JOIN contacts cnt ON cl.contact_id = cnt.id
     JOIN users u ON LOWER(u.email) = LOWER(cnt.email)
     WHERE u.id = ? AND cl.status = 'ACTIVE' AND cnt.deleted_at IS NULL
     LIMIT 1`,
    [userId]
  );

  if (fallbackRows.length > 0) {
    return fallbackRows[0].id;
  }

  const err = new Error("No client profile found or access denied.");
  err.statusCode = 403;
  throw err;
};

/**
 * Get Client's own billing overview dashboard
 * @param {number|object} userOrId
 * @returns {Promise<object>}
 */
const getClientBillingDashboard = async (userOrId) => {
  const clientId = await resolveClientIdFromUser(userOrId);

  const [rows] = await db.execute(
    `SELECT 
       COALESCE(SUM(total_amount), 0) AS total_invoiced,
       COALESCE(SUM(amount_paid), 0) AS total_paid,
       COALESCE(SUM(amount_due), 0) AS total_outstanding,
       COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE() AND amount_due > 0 AND status NOT IN ('CANCELLED', 'VOID', 'PAID') THEN amount_due ELSE 0 END), 0) AS total_overdue,
       COUNT(*) AS total_invoices
     FROM invoices
     WHERE client_id = ? AND status NOT IN ('DRAFT', 'CANCELLED', 'VOID')`,
    [clientId]
  );

  // Recent invoices for this client
  const [recentInvoices] = await db.execute(
    `SELECT id, invoice_number, invoice_date, due_date, total_amount, amount_paid, amount_due, status
     FROM invoices
     WHERE client_id = ? AND status NOT IN ('DRAFT', 'CANCELLED', 'VOID')
     ORDER BY invoice_date DESC, id DESC
     LIMIT 5`,
    [clientId]
  );

  // Recent payments
  const [recentPayments] = await db.execute(
    `SELECT id, payment_number, payment_date, amount, payment_mode, status
     FROM payments
     WHERE client_id = ?
     ORDER BY payment_date DESC, id DESC
     LIMIT 5`,
    [clientId]
  );

  return {
    summary: {
      totalInvoiced: roundDec2(rows[0].total_invoiced),
      totalPaid: roundDec2(rows[0].total_paid),
      totalOutstanding: roundDec2(rows[0].total_outstanding),
      totalOverdue: roundDec2(rows[0].total_overdue),
      totalInvoices: rows[0].total_invoices,
    },
    recentInvoices,
    recentPayments,
  };
};

/**
 * List client invoices
 * @param {number|object} userOrId
 * @param {object} filters
 * @returns {Promise<object>}
 */
const getClientInvoices = async (userOrId, filters = {}) => {
  const clientId = await resolveClientIdFromUser(userOrId);
  // Exclude DRAFT invoices from client view
  const safeFilters = { ...filters, status: filters.status || null };
  const result = await getInvoices(safeFilters, clientId);

  // Filter out any DRAFT invoices that might exist
  result.items = result.items.filter((i) => i.status !== "DRAFT");
  return result;
};

/**
 * Get client invoice detail (stripping internal chambers notes)
 * @param {number|object} userOrId
 * @param {number} invoiceId
 * @returns {Promise<object>}
 */
const getClientInvoiceDetail = async (userOrId, invoiceId) => {
  const clientId = await resolveClientIdFromUser(userOrId);
  const invoice = await getInvoiceById(invoiceId, clientId);

  // Hide internal notes from client
  delete invoice.internal_notes;
  return invoice;
};

/**
 * List client payments
 * @param {number|object} userOrId
 * @param {number} [invoiceId]
 * @returns {Promise<object>}
 */
const getClientPayments = async (userOrId, invoiceId = null) => {
  const clientId = await resolveClientIdFromUser(userOrId);
  return getPayments({ invoice_id: invoiceId }, clientId);
};

module.exports = {
  resolveClientIdFromUser,
  getClientIdForUser: resolveClientIdFromUser,
  getClientBillingDashboard,
  getClientInvoices,
  getClientInvoiceDetail,
  getClientPayments,
};
