const db = require("../config/database");
const { roundDec2 } = require("./billingCalculationService");
const { logBillingEvent } = require("./billingAuditService");

const ALLOWED_FEE_TYPES = ["TIME", "APPEARANCE", "FIXED_FEE", "EXPENSE", "RETAINER_DRAW", "OTHER"];
const ALLOWED_STATUSES = ["UNBILLED", "INVOICED", "CANCELLED"];

/**
 * Validate and compute fee entry amount
 * @param {object} data
 * @returns {{ amount: number, quantity: number, rate: number, durationMinutes: number|null, hourlyRate: number|null }}
 */
const computeFeeEntryAmount = (data) => {
  const feeType = data.fee_type || "FIXED_FEE";

  if (feeType === "TIME") {
    const duration = parseInt(data.duration_minutes, 10) || 0;
    const hourly = roundDec2(data.hourly_rate || data.rate || 0);
    const calculated = roundDec2((duration / 60) * hourly);
    return {
      amount: calculated,
      quantity: roundDec2(duration / 60),
      rate: hourly,
      durationMinutes: duration,
      hourlyRate: hourly,
    };
  }

  if (feeType === "APPEARANCE" || feeType === "FIXED_FEE" || feeType === "EXPENSE" || feeType === "RETAINER_DRAW" || feeType === "OTHER") {
    const qty = data.quantity !== undefined ? Math.max(0.01, roundDec2(data.quantity)) : 1.0;
    const rate = roundDec2(data.rate !== undefined ? data.rate : data.amount !== undefined ? data.amount : 0);
    const amount = data.amount !== undefined && data.rate === undefined
      ? roundDec2(data.amount)
      : roundDec2(qty * rate);

    return {
      amount,
      quantity: qty,
      rate,
      durationMinutes: null,
      hourlyRate: null,
    };
  }

  const amount = roundDec2(data.amount || 0);
  return {
    amount,
    quantity: 1.0,
    rate: amount,
    durationMinutes: null,
    hourlyRate: null,
  };
};

/**
 * Create a new billable fee entry
 * @param {object} entryData
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const createFeeEntry = async (entryData, userId, ip = null, userAgent = null) => {
  const {
    client_id,
    case_id,
    hearing_id,
    fee_type = "FIXED_FEE",
    description,
    service_date,
    is_taxable = true,
    tax_category = "LEGAL_SERVICES",
    unit = "UNIT",
  } = entryData;

  if (!client_id) {
    const err = new Error("client_id is required for billable fee entries.");
    err.statusCode = 422;
    throw err;
  }

  if (!description || !description.trim()) {
    const err = new Error("Description is required.");
    err.statusCode = 422;
    throw err;
  }

  if (!service_date) {
    const err = new Error("service_date is required.");
    err.statusCode = 422;
    throw err;
  }

  if (!ALLOWED_FEE_TYPES.includes(fee_type)) {
    const err = new Error(`Invalid fee_type: ${fee_type}. Allowed: ${ALLOWED_FEE_TYPES.join(", ")}`);
    err.statusCode = 422;
    throw err;
  }

  // 1. Verify Client exists and is active
  const [clientRows] = await db.execute(
    `SELECT id, status FROM clients WHERE id = ?`,
    [client_id]
  );
  if (clientRows.length === 0) {
    const err = new Error("Client not found.");
    err.statusCode = 404;
    throw err;
  }
  if (clientRows[0].status === "ARCHIVED") {
    const err = new Error("Cannot add fee entries to an archived client.");
    err.statusCode = 422;
    throw err;
  }

  // 2. If case_id provided, verify case belongs to client
  if (case_id) {
    const [caseRows] = await db.execute(
      `SELECT id, primary_client_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
      [case_id]
    );
    if (caseRows.length === 0) {
      const err = new Error("Case matter not found.");
      err.statusCode = 404;
      throw err;
    }
    if (caseRows[0].primary_client_id !== parseInt(client_id, 10)) {
      const err = new Error("Specified case does not belong to the selected client.");
      err.statusCode = 422;
      throw err;
    }
  }

  // 3. If hearing_id provided (APPEARANCE fee), verify hearing belongs to case
  if (hearing_id) {
    const [hearingRows] = await db.execute(
      `SELECT ch.id, ch.case_id, ch.hearing_date, c.name AS court_name, cs.case_number
       FROM case_hearings ch
       JOIN cases cs ON ch.case_id = cs.id
       LEFT JOIN courts c ON ch.court_id = c.id
       WHERE ch.id = ?`,
      [hearing_id]
    );
    if (hearingRows.length === 0) {
      const err = new Error("Court hearing not found.");
      err.statusCode = 404;
      throw err;
    }
    if (case_id && hearingRows[0].case_id !== parseInt(case_id, 10)) {
      const err = new Error("Court hearing does not belong to the specified case.");
      err.statusCode = 422;
      throw err;
    }

    // Check duplicate hearing appearance entry unless explicitly allowed
    if (!entryData.allow_duplicate_hearing) {
      const [dup] = await db.execute(
        `SELECT id FROM fee_entries 
         WHERE hearing_id = ? AND status != 'CANCELLED' AND deleted_at IS NULL LIMIT 1`,
        [hearing_id]
      );
      if (dup.length > 0) {
        const err = new Error(
          `A billable fee entry (#${dup[0].id}) is already recorded for this court hearing. Set allow_duplicate_hearing: true if intentional.`
        );
        err.statusCode = 409;
        throw err;
      }
    }
  }

  // 4. Compute monetary amounts
  const computed = computeFeeEntryAmount(entryData);

  if (computed.amount <= 0) {
    const err = new Error("Fee entry amount must be greater than zero.");
    err.statusCode = 422;
    throw err;
  }

  const [result] = await db.execute(
    `INSERT INTO fee_entries (
      client_id, case_id, hearing_id, fee_type, description, service_date,
      duration_minutes, hourly_rate, quantity, unit, rate, amount,
      is_taxable, tax_category, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNBILLED', ?)`,
    [
      client_id,
      case_id || null,
      hearing_id || null,
      fee_type,
      description.trim(),
      service_date,
      computed.durationMinutes,
      computed.hourlyRate,
      computed.quantity,
      unit || "UNIT",
      computed.rate,
      computed.amount,
      is_taxable ? 1 : 0,
      tax_category || "LEGAL_SERVICES",
      userId || null,
    ]
  );

  const entryId = result.insertId;

  await logBillingEvent(
    userId,
    "FEE_ENTRY_CREATED",
    "FEE_ENTRY",
    entryId,
    ip,
    userAgent,
    {
      clientId: client_id,
      caseId: case_id,
      feeType: fee_type,
      amount: computed.amount,
    }
  );

  return getFeeEntryById(entryId);
};

/**
 * Get fee entry by ID with client, case and hearing metadata
 * @param {number} id
 * @returns {Promise<object>}
 */
const getFeeEntryById = async (id) => {
  const [rows] = await db.execute(
    `SELECT 
      fe.*,
      cnt.display_name AS client_name,
      cnt.email AS client_email,
      cl.client_code,
      cs.case_number,
      cs.title AS case_title,
      ch.hearing_date,
      ch.purpose AS hearing_purpose,
      crt.name AS court_name,
      inv.invoice_number
     FROM fee_entries fe
     JOIN clients cl ON fe.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     LEFT JOIN cases cs ON fe.case_id = cs.id
     LEFT JOIN case_hearings ch ON fe.hearing_id = ch.id
     LEFT JOIN courts crt ON ch.court_id = crt.id
     LEFT JOIN invoices inv ON fe.invoice_id = inv.id
     WHERE fe.id = ? AND fe.deleted_at IS NULL`,
    [id]
  );

  if (rows.length === 0) {
    const err = new Error("Fee entry not found.");
    err.statusCode = 404;
    throw err;
  }

  return rows[0];
};

/**
 * List fee entries with flexible filtering and pagination
 * @param {object} filters
 * @returns {Promise<{ items: Array, pagination: object, summary: object }>}
 */
const getFeeEntries = async (filters = {}) => {
  const {
    client_id,
    case_id,
    fee_type,
    status,
    search,
    start_date,
    end_date,
    uninvoiced_only,
    page = 1,
    limit = 20,
  } = filters;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const whereClauses = ["fe.deleted_at IS NULL"];
  const params = [];

  if (client_id) {
    whereClauses.push("fe.client_id = ?");
    params.push(client_id);
  }

  if (case_id) {
    whereClauses.push("fe.case_id = ?");
    params.push(case_id);
  }

  if (fee_type && ALLOWED_FEE_TYPES.includes(fee_type)) {
    whereClauses.push("fe.fee_type = ?");
    params.push(fee_type);
  }

  if (status && ALLOWED_STATUSES.includes(status)) {
    whereClauses.push("fe.status = ?");
    params.push(status);
  }

  if (uninvoiced_only === true || uninvoiced_only === "true") {
    whereClauses.push("fe.status = 'UNBILLED' AND fe.invoice_id IS NULL");
  }

  if (start_date) {
    whereClauses.push("fe.service_date >= ?");
    params.push(start_date);
  }

  if (end_date) {
    whereClauses.push("fe.service_date <= ?");
    params.push(end_date);
  }

  if (search && search.trim()) {
    whereClauses.push("(fe.description LIKE ? OR cnt.display_name LIKE ? OR cs.case_number LIKE ?)");
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  const whereSql = whereClauses.join(" AND ");

  // Count total & summary
  const [countRows] = await db.execute(
    `SELECT 
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN fe.status = 'UNBILLED' THEN fe.amount ELSE 0 END), 0) AS total_unbilled,
       COALESCE(SUM(CASE WHEN fe.status = 'INVOICED' THEN fe.amount ELSE 0 END), 0) AS total_invoiced,
       COALESCE(SUM(fe.amount), 0) AS total_amount
     FROM fee_entries fe
     JOIN clients cl ON fe.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     LEFT JOIN cases cs ON fe.case_id = cs.id
     WHERE ${whereSql}`,
    params
  );

  const total = countRows[0].total;

  // Retrieve paginated items
  const [items] = await db.execute(
    `SELECT 
      fe.*,
      cnt.display_name AS client_name,
      cnt.email AS client_email,
      cl.client_code,
      cs.case_number,
      cs.title AS case_title,
      ch.hearing_date,
      crt.name AS court_name,
      inv.invoice_number
     FROM fee_entries fe
     JOIN clients cl ON fe.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     LEFT JOIN cases cs ON fe.case_id = cs.id
     LEFT JOIN case_hearings ch ON fe.hearing_id = ch.id
     LEFT JOIN courts crt ON ch.court_id = crt.id
     LEFT JOIN invoices inv ON fe.invoice_id = inv.id
     WHERE ${whereSql}
     ORDER BY fe.service_date DESC, fe.id DESC
     LIMIT ${limitNum} OFFSET ${offset}`,
    params
  );

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: Math.ceil(total / limitNum) || 1,
    },
    summary: {
      totalUnbilled: roundDec2(countRows[0].total_unbilled),
      totalInvoiced: roundDec2(countRows[0].total_invoiced),
      totalAmount: roundDec2(countRows[0].total_amount),
    },
  };
};

/**
 * Update an existing unbilled fee entry
 * @param {number} id
 * @param {object} updateData
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const updateFeeEntry = async (id, updateData, userId, ip = null, userAgent = null) => {
  const entry = await getFeeEntryById(id);

  if (entry.status === "INVOICED" || entry.invoice_id) {
    const err = new Error(
      `Cannot modify fee entry #${id} because it has already been invoiced on invoice ${entry.invoice_number || entry.invoice_id}.`
    );
    err.statusCode = 422;
    throw err;
  }

  if (entry.status === "CANCELLED") {
    const err = new Error("Cannot modify a cancelled fee entry.");
    err.statusCode = 422;
    throw err;
  }

  const merged = { ...entry, ...updateData };
  const computed = computeFeeEntryAmount(merged);

  await db.execute(
    `UPDATE fee_entries SET
      fee_type = ?,
      description = ?,
      service_date = ?,
      duration_minutes = ?,
      hourly_rate = ?,
      quantity = ?,
      unit = ?,
      rate = ?,
      amount = ?,
      is_taxable = ?,
      tax_category = ?
     WHERE id = ?`,
    [
      merged.fee_type,
      merged.description.trim(),
      merged.service_date,
      computed.durationMinutes,
      computed.hourlyRate,
      computed.quantity,
      merged.unit || "UNIT",
      computed.rate,
      computed.amount,
      merged.is_taxable ? 1 : 0,
      merged.tax_category || "LEGAL_SERVICES",
      id,
    ]
  );

  await logBillingEvent(userId, "FEE_ENTRY_UPDATED", "FEE_ENTRY", id, ip, userAgent, {
    oldAmount: entry.amount,
    newAmount: computed.amount,
  });

  return getFeeEntryById(id);
};

/**
 * Cancel or soft-delete a fee entry
 * @param {number} id
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<{ message: string }>}
 */
const cancelFeeEntry = async (id, userId, ip = null, userAgent = null) => {
  const entry = await getFeeEntryById(id);

  if (entry.status === "INVOICED" || entry.invoice_id) {
    const err = new Error(
      `Cannot cancel fee entry #${id} because it is locked on invoice ${entry.invoice_number || entry.invoice_id}. Cancel the invoice first.`
    );
    err.statusCode = 422;
    throw err;
  }

  await db.execute(
    `UPDATE fee_entries SET status = 'CANCELLED', deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [id]
  );

  await logBillingEvent(userId, "FEE_ENTRY_CANCELLED", "FEE_ENTRY", id, ip, userAgent, {
    amount: entry.amount,
  });

  return { message: "Fee entry cancelled successfully." };
};

module.exports = {
  ALLOWED_FEE_TYPES,
  ALLOWED_STATUSES,
  computeFeeEntryAmount,
  createFeeEntry,
  getFeeEntryById,
  getFeeEntries,
  updateFeeEntry,
  cancelFeeEntry,
};
