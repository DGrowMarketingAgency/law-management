const pool = require("../config/database");
const { ApiError } = require("../middleware/errorHandler");

/**
 * LeaveService
 * Manages leave requests, balance ledgers, date collision checks,
 * approval workflows, and attendance log synchronization.
 */
class LeaveService {
  /**
   * Get leave types
   */
  static async getLeaveTypes(workforceType = null) {
    let sql = `SELECT * FROM workforce_leave_types WHERE active = TRUE`;
    const params = [];

    if (workforceType) {
      const isIntern = workforceType.includes("INTERN");
      sql += ` AND applicable_to IN ('ALL', ?)`;
      params.push(isIntern ? "INTERN_ONLY" : "EMPLOYEE_ONLY");
    }

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  /**
   * Get balances for a workforce member
   */
  static async getBalances(workforceId, year = new Date().getFullYear()) {
    const [rows] = await pool.query(
      `SELECT wlb.*, wlt.name AS leave_type_name, wlt.code AS leave_type_code, wlt.is_paid
       FROM workforce_leave_balances wlb
       JOIN workforce_leave_types wlt ON wlb.leave_type_id = wlt.id
       WHERE wlb.workforce_id = ? AND wlb.year = ?`,
      [workforceId, year]
    );
    return rows;
  }

  /**
   * Apply for leave
   */
  static async applyLeave(workforceId, data) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const { leave_type_id, start_date, end_date, total_days, reason } = data;

      if (!start_date || !end_date || !leave_type_id || !reason) {
        throw new ApiError(400, "Start date, end date, leave type, and reason are required.");
      }

      // Check member profile
      const [profiles] = await conn.query(
        `SELECT * FROM workforce_profiles WHERE id = ?`,
        [workforceId]
      );
      if (profiles.length === 0) {
        throw new ApiError(404, "Workforce profile not found.");
      }
      const profile = profiles[0];

      // Verify leave type eligibility
      const [leaveTypes] = await conn.query(
        `SELECT * FROM workforce_leave_types WHERE id = ? AND active = TRUE`,
        [leave_type_id]
      );
      if (leaveTypes.length === 0) {
        throw new ApiError(404, "Leave type not found or inactive.");
      }
      const leaveType = leaveTypes[0];

      const isIntern = profile.workforce_type.includes("INTERN");
      if (isIntern && leaveType.applicable_to === "EMPLOYEE_ONLY") {
        throw new ApiError(400, `Interns are not eligible for ${leaveType.name}.`);
      }

      // Check date collision with existing pending or approved leaves
      const [overlaps] = await conn.query(
        `SELECT id FROM workforce_leave_requests
         WHERE workforce_id = ? 
           AND status IN ('PENDING', 'APPROVED')
           AND (
             (start_date BETWEEN ? AND ?) OR
             (end_date BETWEEN ? AND ?) OR
             (? BETWEEN start_date AND end_date)
           )`,
        [workforceId, start_date, end_date, start_date, end_date, start_date]
      );

      if (overlaps.length > 0) {
        throw new ApiError(400, "You already have a pending or approved leave overlapping these dates.");
      }

      const year = new Date(start_date).getFullYear();
      const requestedDays = parseFloat(total_days) || 1.0;

      // Check balance (Except for UNPAID leave)
      if (leaveType.code !== "UNPAID") {
        const [balances] = await conn.query(
          `SELECT * FROM workforce_leave_balances 
           WHERE workforce_id = ? AND leave_type_id = ? AND year = ? FOR UPDATE`,
          [workforceId, leave_type_id, year]
        );

        if (balances.length === 0 || balances[0].remaining < requestedDays) {
          const available = balances.length > 0 ? balances[0].remaining : 0;
          throw new ApiError(
            400,
            `Insufficient leave balance for ${leaveType.name}. Available: ${available} day(s), Requested: ${requestedDays} day(s).`
          );
        }

        // Put into pending
        await conn.query(
          `UPDATE workforce_leave_balances
           SET pending = pending + ?
           WHERE id = ?`,
          [requestedDays, balances[0].id]
        );
      }

      // Insert leave request
      const [res] = await conn.query(
        `INSERT INTO workforce_leave_requests
         (workforce_id, leave_type_id, start_date, end_date, total_days, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
        [workforceId, leave_type_id, start_date, end_date, requestedDays, reason]
      );

      await conn.commit();
      return { id: res.insertId, status: "PENDING", total_days: requestedDays };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * List leave requests with filters
   */
  static async getLeaveRequests(filters = {}, requestingUser) {
    const { workforce_id, status, page = 1, limit = 20 } = filters;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let whereClause = "WHERE 1=1";

    if (workforce_id) {
      whereClause += " AND wlr.workforce_id = ?";
      params.push(workforce_id);
    }

    if (status) {
      whereClause += " AND wlr.status = ?";
      params.push(status);
    }

    // Security scope: if INTERN or JUNIOR_ASSOCIATE, only view own requests
    if (["INTERN", "JUNIOR_ASSOCIATE"].includes(requestingUser.role)) {
      whereClause += " AND wp.user_id = ?";
      params.push(requestingUser.id);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM workforce_leave_requests wlr
       JOIN workforce_profiles wp ON wlr.workforce_id = wp.id
       ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT 
        wlr.*,
        wlt.name AS leave_type_name,
        wlt.code AS leave_type_code,
        wp.workforce_code,
        wp.workforce_type,
        wp.designation,
        c.first_name,
        c.last_name,
        approver.first_name AS approver_first_name,
        approver.last_name AS approver_last_name
       FROM workforce_leave_requests wlr
       JOIN workforce_leave_types wlt ON wlr.leave_type_id = wlt.id
       JOIN workforce_profiles wp ON wlr.workforce_id = wp.id
       JOIN contacts c ON wp.contact_id = c.id
       LEFT JOIN users approver ON wlr.approved_by = approver.id
       ${whereClause}
       ORDER BY wlr.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return {
      requests: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    };
  }

  /**
   * Approve or reject leave request
   */
  static async processLeaveRequest(id, action, data = {}, approverUserId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [requests] = await conn.query(
        `SELECT wlr.*, wlt.code AS leave_type_code 
         FROM workforce_leave_requests wlr
         JOIN workforce_leave_types wlt ON wlr.leave_type_id = wlt.id
         WHERE wlr.id = ? FOR UPDATE`,
        [id]
      );

      if (requests.length === 0) {
        throw new ApiError(404, "Leave request not found.");
      }
      const req = requests[0];

      if (req.status !== "PENDING") {
        throw new ApiError(400, `Leave request is already ${req.status}.`);
      }

      const year = new Date(req.start_date).getFullYear();
      const days = parseFloat(req.total_days);

      if (action === "APPROVE") {
        // Adjust balance
        if (req.leave_type_code !== "UNPAID") {
          await conn.query(
            `UPDATE workforce_leave_balances
             SET pending = GREATEST(0, pending - ?),
                 used = used + ?,
                 remaining = GREATEST(0, remaining - ?)
             WHERE workforce_id = ? AND leave_type_id = ? AND year = ?`,
            [days, days, days, req.workforce_id, req.leave_type_id, year]
          );
        }

        // Update request status
        await conn.query(
          `UPDATE workforce_leave_requests
           SET status = 'APPROVED', approved_by = ?, approved_at = NOW()
           WHERE id = ?`,
          [approverUserId, id]
        );

        // Sync with workforce_attendance calendar for these dates
        const curDate = new Date(req.start_date);
        const endDate = new Date(req.end_date);

        while (curDate <= endDate) {
          const dateStr = curDate.toISOString().slice(0, 10);
          await conn.query(
            `INSERT INTO workforce_attendance
             (workforce_id, attendance_date, status, source, remarks)
             VALUES (?, ?, 'LEAVE', 'SYSTEM', ?)
             ON DUPLICATE KEY UPDATE status = 'LEAVE', remarks = VALUES(remarks)`,
            [req.workforce_id, dateStr, `Approved Leave: ${req.reason}`]
          );
          curDate.setDate(curDate.getDate() + 1);
        }
      } else if (action === "REJECT") {
        // Release pending balance
        if (req.leave_type_code !== "UNPAID") {
          await conn.query(
            `UPDATE workforce_leave_balances
             SET pending = GREATEST(0, pending - ?)
             WHERE workforce_id = ? AND leave_type_id = ? AND year = ?`,
            [days, req.workforce_id, req.leave_type_id, year]
          );
        }

        await conn.query(
          `UPDATE workforce_leave_requests
           SET status = 'REJECTED', approved_by = ?, approved_at = NOW(), rejection_reason = ?
           WHERE id = ?`,
          [approverUserId, data.rejection_reason || "Rejected by administration", id]
        );
      } else {
        throw new ApiError(400, "Invalid leave action. Must be APPROVE or REJECT.");
      }

      await conn.commit();
      return { id, status: action === "APPROVE" ? "APPROVED" : "REJECTED" };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = LeaveService;
