const db = require("../config/database");
const { roundDec2 } = require("./billingCalculationService");
const { logBillingEvent } = require("./billingAuditService");

/**
 * Create a new Retainer trust account
 * @param {object} retainerData
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const createRetainer = async (retainerData, userId, ip = null, userAgent = null) => {
  const {
    client_id,
    case_id,
    name,
    opening_amount = 0,
    currency = "INR",
    start_date,
    expiry_date,
    notes,
  } = retainerData;

  if (!client_id) {
    const err = new Error("client_id is required.");
    err.statusCode = 422;
    throw err;
  }

  if (!name || !name.trim()) {
    const err = new Error("Retainer account name is required.");
    err.statusCode = 422;
    throw err;
  }

  if (!start_date) {
    const err = new Error("start_date is required.");
    err.statusCode = 422;
    throw err;
  }

  const openingBal = roundDec2(opening_amount);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Verify Client
    const [clientRows] = await conn.query(
      `SELECT id FROM clients WHERE id = ?`,
      [client_id]
    );
    if (clientRows.length === 0) {
      const err = new Error("Client not found.");
      err.statusCode = 404;
      throw err;
    }

    // 2. Verify Case if provided
    if (case_id) {
      const [caseRows] = await conn.query(
        `SELECT id, primary_client_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
        [case_id]
      );
      if (caseRows.length === 0 || caseRows[0].primary_client_id !== parseInt(client_id, 10)) {
        const err = new Error("Case does not belong to the selected client.");
        err.statusCode = 422;
        throw err;
      }
    }

    // 3. Insert Retainer
    const [result] = await conn.query(
      `INSERT INTO retainers (
        client_id, case_id, name, opening_amount, current_balance, currency,
        start_date, expiry_date, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [
        client_id,
        case_id || null,
        name.trim(),
        openingBal,
        openingBal,
        currency || "INR",
        start_date,
        expiry_date || null,
        notes || null,
        userId || null,
      ]
    );

    const retainerId = result.insertId;

    // 4. If opening balance > 0, log initial deposit transaction
    if (openingBal > 0) {
      await conn.query(
        `INSERT INTO retainer_transactions (
          retainer_id, transaction_type, amount, transaction_date, balance_after,
          reference, description, created_by
        ) VALUES (?, 'DEPOSIT', ?, ?, ?, 'OPENING', 'Initial opening retainer deposit', ?)`,
        [retainerId, openingBal, start_date, openingBal, userId || null]
      );
    }

    // 5. Audit Log
    await logBillingEvent(userId, "RETAINER_CREATED", "RETAINER", retainerId, ip, userAgent, {
      clientId: client_id,
      name,
      openingAmount: openingBal,
    }, conn);

    await conn.commit();
    return getRetainerById(retainerId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Get Retainer details by ID with transaction ledger
 * @param {number} id
 * @param {number} [clientRestrictionId]
 * @returns {Promise<object>}
 */
const getRetainerById = async (id, clientRestrictionId = null) => {
  let where = "r.id = ?";
  const params = [id];

  if (clientRestrictionId) {
    where += " AND r.client_id = ?";
    params.push(clientRestrictionId);
  }

  const [rows] = await db.execute(
    `SELECT 
      r.*,
      cnt.display_name AS client_name,
      cl.client_code,
      cs.case_number,
      cs.title AS case_title,
      u.first_name AS creator_first_name,
      u.last_name AS creator_last_name
     FROM retainers r
     JOIN clients cl ON r.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     LEFT JOIN cases cs ON r.case_id = cs.id
     LEFT JOIN users u ON r.created_by = u.id
     WHERE ${where}`,
    params
  );

  if (rows.length === 0) {
    const err = new Error("Retainer account not found or access denied.");
    err.statusCode = 404;
    throw err;
  }

  const retainer = rows[0];

  const [transactions] = await db.execute(
    `SELECT rt.*, inv.invoice_number, u.first_name, u.last_name
     FROM retainer_transactions rt
     LEFT JOIN invoices inv ON rt.invoice_id = inv.id
     LEFT JOIN users u ON rt.created_by = u.id
     WHERE rt.retainer_id = ?
     ORDER BY rt.transaction_date DESC, rt.id DESC`,
    [id]
  );

  retainer.transactions = transactions;
  return retainer;
};

/**
 * List retainers with filters
 * @param {object} filters
 * @param {number} [clientRestrictionId]
 * @returns {Promise<{ items: Array, summary: object }>}
 */
const getRetainers = async (filters = {}, clientRestrictionId = null) => {
  const { client_id, case_id, status } = filters;
  const whereClauses = ["1 = 1"];
  const params = [];

  if (clientRestrictionId) {
    whereClauses.push("r.client_id = ?");
    params.push(clientRestrictionId);
  } else if (client_id) {
    whereClauses.push("r.client_id = ?");
    params.push(client_id);
  }

  if (case_id) {
    whereClauses.push("r.case_id = ?");
    params.push(case_id);
  }

  if (status) {
    whereClauses.push("r.status = ?");
    params.push(status);
  }

  const whereSql = whereClauses.join(" AND ");

  const [rows] = await db.execute(
    `SELECT 
      r.*,
      cnt.display_name AS client_name,
      cl.client_code,
      cs.case_number
     FROM retainers r
     JOIN clients cl ON r.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     LEFT JOIN cases cs ON r.case_id = cs.id
     WHERE ${whereSql}
     ORDER BY r.current_balance DESC, r.id DESC`,
    params
  );

  const [summaryRows] = await db.execute(
    `SELECT 
       COUNT(*) AS total_count,
       COALESCE(SUM(current_balance), 0) AS total_balance,
       COALESCE(SUM(opening_amount), 0) AS total_opening
     FROM retainers r
     WHERE ${whereSql}`,
    params
  );

  return {
    items: rows,
    summary: {
      totalCount: summaryRows[0].total_count,
      totalBalance: roundDec2(summaryRows[0].total_balance),
      totalOpening: roundDec2(summaryRows[0].total_opening),
    },
  };
};

/**
 * Add funds / deposit into a retainer account
 * @param {number} id
 * @param {object} depositData
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const depositRetainer = async (id, depositData, userId, ip = null, userAgent = null) => {
  const { amount, transaction_date, reference, description = "Retainer deposit" } = depositData;

  const depositAmount = roundDec2(amount);
  if (depositAmount <= 0) {
    const err = new Error("Deposit amount must be greater than zero.");
    err.statusCode = 422;
    throw err;
  }

  const date = transaction_date || new Date().toISOString().split("T")[0];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM retainers WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      const err = new Error("Retainer account not found.");
      err.statusCode = 404;
      throw err;
    }

    const retainer = rows[0];
    const newBalance = roundDec2(retainer.current_balance + depositAmount);

    await conn.query(
      `UPDATE retainers SET current_balance = ?, status = 'ACTIVE' WHERE id = ?`,
      [newBalance, id]
    );

    await conn.query(
      `INSERT INTO retainer_transactions (
        retainer_id, transaction_type, amount, transaction_date, balance_after,
        reference, description, created_by
      ) VALUES (?, 'DEPOSIT', ?, ?, ?, ?, ?, ?)`,
      [id, depositAmount, date, newBalance, reference || null, description, userId || null]
    );

    await logBillingEvent(userId, "RETAINER_DEPOSITED", "RETAINER", id, ip, userAgent, {
      amount: depositAmount,
      newBalance,
    }, conn);

    await conn.commit();
    return getRetainerById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Refund remaining unearned retainer balance back to client
 * @param {number} id
 * @param {object} refundData
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const refundRetainer = async (id, refundData, userId, ip = null, userAgent = null) => {
  const { amount, transaction_date, reference, description = "Retainer refund to client" } = refundData;

  const refundAmount = roundDec2(amount);
  if (refundAmount <= 0) {
    const err = new Error("Refund amount must be greater than zero.");
    err.statusCode = 422;
    throw err;
  }

  const date = transaction_date || new Date().toISOString().split("T")[0];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM retainers WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      const err = new Error("Retainer account not found.");
      err.statusCode = 404;
      throw err;
    }

    const retainer = rows[0];

    if (refundAmount > retainer.current_balance) {
      const err = new Error(
        `Requested refund amount (₹${refundAmount}) exceeds available retainer balance (₹${retainer.current_balance}).`
      );
      err.statusCode = 422;
      throw err;
    }

    const newBalance = roundDec2(retainer.current_balance - refundAmount);
    const newStatus = newBalance === 0 ? "CLOSED" : "ACTIVE";

    await conn.query(
      `UPDATE retainers SET current_balance = ?, status = ? WHERE id = ?`,
      [newBalance, newStatus, id]
    );

    await conn.query(
      `INSERT INTO retainer_transactions (
        retainer_id, transaction_type, amount, transaction_date, balance_after,
        reference, description, created_by
      ) VALUES (?, 'REFUND', ?, ?, ?, ?, ?, ?)`,
      [id, refundAmount, date, newBalance, reference || null, description, userId || null]
    );

    await logBillingEvent(userId, "RETAINER_REFUNDED", "RETAINER", id, ip, userAgent, {
      refundAmount,
      newBalance,
    }, conn);

    await conn.commit();
    return getRetainerById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  createRetainer,
  getRetainerById,
  getRetainers,
  listRetainers: getRetainers,
  depositRetainer,
  depositFunds: depositRetainer,
  refundRetainer,
  refundFunds: refundRetainer,
};
