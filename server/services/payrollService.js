const pool = require("../config/database");
const WorkforceCodeService = require("./workforceCodeService");
const WorkforceSecurityService = require("./workforceSecurityService");
const { ApiError } = require("../middleware/errorHandler");

/**
 * PayrollService
 * Handles internal workforce compensation (Employee Salaries, Paid Intern Stipends,
 * Reimbursements, and Encrypted Bank Accounts). Strictly decoupled from Client Billing.
 */
class PayrollService {
  /**
   * Configure or update employee salary structure
   */
  static async setSalaryStructure(workforceId, data, currentUserId) {
    const [profiles] = await pool.query(
      `SELECT * FROM workforce_profiles WHERE id = ?`,
      [workforceId]
    );
    if (profiles.length === 0) {
      throw new ApiError(404, "Workforce profile not found.");
    }
    const profile = profiles[0];

    if (profile.workforce_type !== "EMPLOYEE" && profile.workforce_type !== "CONTRACTOR") {
      throw new ApiError(400, "Salary structures can only be configured for Employees or Contractors.");
    }

    const gross = parseFloat(data.gross_amount) || 0.0;
    const basic = parseFloat(data.basic_amount) || (gross * 0.5);
    const allowances = parseFloat(data.allowances_amount) || (gross - basic);
    const deductions = parseFloat(data.deductions_amount) || 0.0;

    // Archive previous active structures
    await pool.query(
      `UPDATE employee_salary_structures SET status = 'ENDED' WHERE workforce_id = ? AND status = 'ACTIVE'`,
      [workforceId]
    );

    const [res] = await pool.query(
      `INSERT INTO employee_salary_structures
       (workforce_id, effective_from, payment_frequency, gross_amount, basic_amount, 
        allowances_amount, deductions_amount, components, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [
        workforceId,
        data.effective_from || new Date().toISOString().slice(0, 10),
        data.payment_frequency || "MONTHLY",
        gross,
        basic,
        allowances,
        deductions,
        data.components ? JSON.stringify(data.components) : null,
        data.notes || null,
      ]
    );

    return { id: res.insertId, gross_amount: gross, status: "ACTIVE" };
  }

  /**
   * Configure or update intern stipend
   */
  static async setInternStipend(workforceId, data, currentUserId) {
    const [profiles] = await pool.query(
      `SELECT * FROM workforce_profiles WHERE id = ?`,
      [workforceId]
    );
    if (profiles.length === 0) {
      throw new ApiError(404, "Workforce profile not found.");
    }
    const profile = profiles[0];

    if (!profile.workforce_type.includes("INTERN")) {
      throw new ApiError(400, "Stipend configurations only apply to interns.");
    }

    // STRICT DISTINCTION: If profile is UNPAID_INTERN, it must never be given an active stipend unless upgraded to PAID_INTERN
    if (profile.workforce_type === "UNPAID_INTERN") {
      throw new ApiError(
        400,
        "Cannot configure stipend for an UNPAID intern. Convert workforce type to PAID_INTERN first."
      );
    }

    const stipendAmount = parseFloat(data.stipend_amount) || 0.0;

    await pool.query(
      `UPDATE internship_records
       SET stipend_enabled = TRUE,
           stipend_amount = ?,
           stipend_frequency = COALESCE(?, stipend_frequency)
       WHERE workforce_id = ?`,
      [stipendAmount, data.stipend_frequency || "MONTHLY", workforceId]
    );

    return { workforce_id: workforceId, stipend_enabled: true, stipend_amount: stipendAmount };
  }

  /**
   * Save or update bank account with AES-256-GCM encryption at rest
   */
  static async saveBankAccount(workforceId, data) {
    const [profiles] = await pool.query(
      `SELECT * FROM workforce_profiles WHERE id = ?`,
      [workforceId]
    );
    if (profiles.length === 0) {
      throw new ApiError(404, "Workforce profile not found.");
    }

    const { account_holder_name, bank_name, account_number, ifsc, upi_id } = data;

    if (!account_holder_name || !bank_name || !account_number || !ifsc) {
      throw new ApiError(400, "Account holder, bank name, account number, and IFSC are required.");
    }

    const encAcc = WorkforceSecurityService.encrypt(account_number);
    const maskedAcc = WorkforceSecurityService.maskAccountNumber(account_number);
    const encIfsc = WorkforceSecurityService.encrypt(ifsc);
    const maskedIfsc = WorkforceSecurityService.maskIfsc(ifsc);

    await pool.query(
      `INSERT INTO workforce_bank_accounts
       (workforce_id, account_holder_name, bank_name, account_number_encrypted, 
        account_number_masked, ifsc_encrypted, ifsc_masked, upi_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         account_holder_name = VALUES(account_holder_name),
         bank_name = VALUES(bank_name),
         account_number_encrypted = VALUES(account_number_encrypted),
         account_number_masked = VALUES(account_number_masked),
         ifsc_encrypted = VALUES(ifsc_encrypted),
         ifsc_masked = VALUES(ifsc_masked),
         upi_id = VALUES(upi_id)`,
      [
        workforceId,
        account_holder_name,
        bank_name,
        encAcc,
        maskedAcc,
        encIfsc,
        maskedIfsc,
        upi_id || null,
      ]
    );

    return {
      workforce_id: workforceId,
      account_holder_name,
      bank_name,
      account_number_masked: maskedAcc,
      ifsc_masked: maskedIfsc,
      upi_id: upi_id || null,
    };
  }

  /**
   * Generate internal workforce disbursement (Salary or Stipend)
   */
  static async createDisbursement(data, currentUserId) {
    const { workforce_id, payment_type, period_start, period_end, gross_amount, deductions = 0.0, payment_method, notes } = data;

    const [profiles] = await pool.query(
      `SELECT * FROM workforce_profiles WHERE id = ?`,
      [workforce_id]
    );
    if (profiles.length === 0) {
      throw new ApiError(404, "Workforce profile not found.");
    }
    const profile = profiles[0];

    // STRICT GUARD: Unpaid interns must never receive stipend disbursements
    if (payment_type === "STIPEND") {
      if (profile.workforce_type === "UNPAID_INTERN") {
        throw new ApiError(400, "Disbursement blocked: Unpaid interns are strictly not eligible for stipend payments.");
      }
      const [intRec] = await pool.query(
        `SELECT stipend_enabled FROM internship_records WHERE workforce_id = ?`,
        [workforce_id]
      );
      if (intRec.length === 0 || !intRec[0].stipend_enabled) {
        throw new ApiError(400, "Disbursement blocked: Stipend is not enabled for this intern record.");
      }
    }

    const gross = parseFloat(gross_amount) || 0.0;
    const ded = parseFloat(deductions) || 0.0;
    const net = Math.max(0, gross - ded);

    const payCode = await WorkforceCodeService.generateCode(
      "PAY",
      "workforce_payments",
      "payment_number"
    );

    const [res] = await pool.query(
      `INSERT INTO workforce_payments
       (payment_number, workforce_id, payment_type, period_start, period_end, 
        gross_amount, deductions, net_amount, payment_method, status, notes, approved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [
        payCode,
        workforce_id,
        payment_type,
        period_start,
        period_end,
        gross,
        ded,
        net,
        payment_method || "BANK_TRANSFER",
        notes || null,
        currentUserId,
      ]
    );

    return { id: res.insertId, payment_number: payCode, net_amount: net, status: "PENDING" };
  }

  /**
   * Mark disbursement as PAID
   */
  static async markDisbursementPaid(paymentId, data, currentUserId) {
    const [rows] = await pool.query(
      `SELECT * FROM workforce_payments WHERE id = ?`,
      [paymentId]
    );
    if (rows.length === 0) {
      throw new ApiError(404, "Workforce payment not found.");
    }

    await pool.query(
      `UPDATE workforce_payments
       SET status = 'PAID', 
           payment_date = ?, 
           reference_number = ?,
           approved_by = ?
       WHERE id = ?`,
      [
        data.payment_date || new Date().toISOString().slice(0, 10),
        data.reference_number || null,
        currentUserId,
        paymentId,
      ]
    );

    return { id: paymentId, status: "PAID" };
  }

  /**
   * List workforce payments with filters
   */
  static async getDisbursements(filters = {}) {
    const { workforce_id, payment_type, status, page = 1, limit = 20 } = filters;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let whereClause = "WHERE 1=1";

    if (workforce_id) {
      whereClause += " AND wp.workforce_id = ?";
      params.push(workforce_id);
    }

    if (payment_type) {
      whereClause += " AND wp.payment_type = ?";
      params.push(payment_type);
    }

    if (status) {
      whereClause += " AND wp.status = ?";
      params.push(status);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM workforce_payments wp ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT 
        wp.*,
        wfp.workforce_code,
        wfp.workforce_type,
        wfp.designation,
        c.first_name,
        c.last_name,
        ba.bank_name,
        ba.account_number_masked
       FROM workforce_payments wp
       JOIN workforce_profiles wfp ON wp.workforce_id = wfp.id
       JOIN contacts c ON wfp.contact_id = c.id
       LEFT JOIN workforce_bank_accounts ba ON wfp.id = ba.workforce_id
       ${whereClause}
       ORDER BY wp.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return {
      payments: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    };
  }

  /**
   * Submit expense reimbursement claim
   */
  static async submitReimbursement(workforceId, data) {
    const claimNumber = await WorkforceCodeService.generateCode(
      "CLM",
      "workforce_reimbursements",
      "claim_number"
    );

    const [res] = await pool.query(
      `INSERT INTO workforce_reimbursements
       (claim_number, workforce_id, expense_date, category, amount, description, status)
       VALUES (?, ?, ?, ?, ?, ?, 'SUBMITTED')`,
      [
        claimNumber,
        workforceId,
        data.expense_date || new Date().toISOString().slice(0, 10),
        data.category || "COURT_FEE",
        parseFloat(data.amount) || 0.0,
        data.description,
      ]
    );

    return { id: res.insertId, claim_number: claimNumber, status: "SUBMITTED" };
  }

  /**
   * List reimbursement claims
   */
  static async getReimbursements(filters = {}, requestingUser) {
    const { workforce_id, status, page = 1, limit = 20 } = filters;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let whereClause = "WHERE 1=1";

    if (workforce_id) {
      whereClause += " AND wr.workforce_id = ?";
      params.push(workforce_id);
    }

    if (status) {
      whereClause += " AND wr.status = ?";
      params.push(status);
    }

    // Security guard: If junior associate or intern, only see own claims
    if (["JUNIOR_ASSOCIATE", "INTERN"].includes(requestingUser.role)) {
      whereClause += " AND wp.user_id = ?";
      params.push(requestingUser.id);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM workforce_reimbursements wr 
       JOIN workforce_profiles wp ON wr.workforce_id = wp.id 
       ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT 
        wr.*,
        wp.workforce_code,
        c.first_name,
        c.last_name
       FROM workforce_reimbursements wr
       JOIN workforce_profiles wp ON wr.workforce_id = wp.id
       JOIN contacts c ON wp.contact_id = c.id
       ${whereClause}
       ORDER BY wr.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return {
      claims: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    };
  }

  /**
   * Approve or reject reimbursement claim
   */
  static async processReimbursement(id, action, data = {}, currentUserId) {
    const isApproved = action === "APPROVE";

    await pool.query(
      `UPDATE workforce_reimbursements
       SET status = ?,
           approved_by = ?,
           approved_at = NOW(),
           rejection_reason = ?
       WHERE id = ?`,
      [
        isApproved ? "APPROVED" : "REJECTED",
        currentUserId,
        isApproved ? null : (data.rejection_reason || "Claim rejected"),
        id,
      ]
    );

    return { id, status: isApproved ? "APPROVED" : "REJECTED" };
  }
}

module.exports = PayrollService;
