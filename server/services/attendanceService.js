const pool = require("../config/database");
const { ApiError } = require("../middleware/errorHandler");

/**
 * AttendanceService
 * Daily check-in/check-out, automated shift hours calculation,
 * punctuality tracking, regularization, and monthly summaries.
 */
class AttendanceService {
  /**
   * Record Check-in
   */
  static async checkIn(workforceId, data = {}) {
    const today = data.attendance_date || new Date().toISOString().slice(0, 10);
    const now = new Date();
    const checkInTime = data.check_in || now.toTimeString().slice(0, 8);

    // Get active schedule to evaluate punctuality
    const [schedules] = await pool.query(
      `SELECT * FROM workforce_working_schedules WHERE active = TRUE LIMIT 1`
    );
    const schedule = schedules[0] || {
      start_time: "09:30:00",
      grace_minutes: 15,
    };

    let status = "PRESENT";
    if (data.status) {
      status = data.status;
    } else {
      // Compare checkInTime with schedule start_time + grace_minutes
      const [schedH, schedM] = schedule.start_time.split(":").map(Number);
      const graceTotalMinutes = schedH * 60 + schedM + (schedule.grace_minutes || 0);

      const [inH, inM] = checkInTime.split(":").map(Number);
      const inTotalMinutes = inH * 60 + inM;

      if (inTotalMinutes > graceTotalMinutes) {
        status = "LATE";
      }
    }

    const [existing] = await pool.query(
      `SELECT * FROM workforce_attendance WHERE workforce_id = ? AND attendance_date = ?`,
      [workforceId, today]
    );

    if (existing.length > 0) {
      if (existing[0].check_in) {
        throw new ApiError(400, `Check-in already logged for ${today} at ${existing[0].check_in}.`);
      }
      await pool.query(
        `UPDATE workforce_attendance 
         SET check_in = ?, status = ?, remarks = COALESCE(?, remarks)
         WHERE id = ?`,
        [checkInTime, status, data.remarks || null, existing[0].id]
      );
      return { id: existing[0].id, check_in: checkInTime, status };
    }

    const [res] = await pool.query(
      `INSERT INTO workforce_attendance
       (workforce_id, attendance_date, check_in, status, source, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        workforceId,
        today,
        checkInTime,
        status,
        data.source || "WEB",
        data.remarks || null,
      ]
    );

    return { id: res.insertId, check_in: checkInTime, status };
  }

  /**
   * Record Check-out
   */
  static async checkOut(workforceId, data = {}) {
    const today = data.attendance_date || new Date().toISOString().slice(0, 10);
    const now = new Date();
    const checkOutTime = data.check_out || now.toTimeString().slice(0, 8);

    const [rows] = await pool.query(
      `SELECT * FROM workforce_attendance WHERE workforce_id = ? AND attendance_date = ?`,
      [workforceId, today]
    );

    if (rows.length === 0 || !rows[0].check_in) {
      throw new ApiError(400, "Cannot check-out without prior check-in for today.");
    }

    const record = rows[0];

    // Compute total hours
    const [inH, inM, inS = 0] = record.check_in.split(":").map(Number);
    const [outH, outM, outS = 0] = checkOutTime.split(":").map(Number);
    const diffMs = (outH * 3600 + outM * 60 + outS - (inH * 3600 + inM * 60 + inS)) * 1000;
    const diffHours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));

    let finalStatus = record.status;
    if (diffHours < 4.0 && record.status === "PRESENT") {
      finalStatus = "HALF_DAY";
    }

    await pool.query(
      `UPDATE workforce_attendance
       SET check_out = ?, total_hours = ?, status = ?
       WHERE id = ?`,
      [checkOutTime, diffHours, finalStatus, record.id]
    );

    return {
      id: record.id,
      check_in: record.check_in,
      check_out: checkOutTime,
      total_hours: diffHours,
      status: finalStatus,
    };
  }

  /**
   * Get attendance logs with filters
   */
  static async getLogs(filters = {}) {
    const {
      workforce_id,
      date_from,
      date_to,
      status,
      page = 1,
      limit = 30,
    } = filters;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let whereClause = "WHERE 1=1";

    if (workforce_id) {
      whereClause += " AND wa.workforce_id = ?";
      params.push(workforce_id);
    }

    if (date_from) {
      whereClause += " AND wa.attendance_date >= ?";
      params.push(date_from);
    }

    if (date_to) {
      whereClause += " AND wa.attendance_date <= ?";
      params.push(date_to);
    }

    if (status) {
      whereClause += " AND wa.status = ?";
      params.push(status);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM workforce_attendance wa ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT 
        wa.*,
        wp.workforce_code,
        wp.workforce_type,
        wp.designation,
        c.first_name,
        c.last_name
       FROM workforce_attendance wa
       JOIN workforce_profiles wp ON wa.workforce_id = wp.id
       JOIN contacts c ON wp.contact_id = c.id
       ${whereClause}
       ORDER BY wa.attendance_date DESC, wa.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return {
      logs: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    };
  }

  /**
   * Regularize attendance
   */
  static async regularizeAttendance(id, data, currentUserId) {
    const [rows] = await pool.query(
      `SELECT * FROM workforce_attendance WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) {
      throw new ApiError(404, "Attendance record not found.");
    }

    let totalHours = rows[0].total_hours;
    if (data.check_in && data.check_out) {
      const [inH, inM] = data.check_in.split(":").map(Number);
      const [outH, outM] = data.check_out.split(":").map(Number);
      totalHours = Math.max(0, parseFloat((outH + outM / 60 - (inH + inM / 60)).toFixed(2)));
    }

    await pool.query(
      `UPDATE workforce_attendance
       SET check_in = COALESCE(?, check_in),
           check_out = COALESCE(?, check_out),
           total_hours = ?,
           status = COALESCE(?, status),
           source = 'REGULARIZED',
           remarks = CONCAT(COALESCE(remarks, ''), ' [Regularized: ', ?, ' by User #', ?, ']')
       WHERE id = ?`,
      [
        data.check_in || null,
        data.check_out || null,
        totalHours,
        data.status || null,
        data.reason || "Manual adjustment",
        currentUserId,
        id,
      ]
    );

    return { id, status: "REGULARIZED" };
  }

  /**
   * Monthly attendance summary for a workforce member
   */
  static async getMonthlySummary(workforceId, year, month) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-31`;

    const [summary] = await pool.query(
      `SELECT 
        COUNT(*) AS total_days_logged,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) AS present_days,
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) AS late_days,
        SUM(CASE WHEN status = 'HALF_DAY' THEN 1 ELSE 0 END) AS half_days,
        SUM(CASE WHEN status = 'WORK_FROM_HOME' THEN 1 ELSE 0 END) AS wfh_days,
        SUM(CASE WHEN status = 'LEAVE' THEN 1 ELSE 0 END) AS leave_days,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) AS absent_days,
        COALESCE(SUM(total_hours), 0) AS total_hours_worked
       FROM workforce_attendance
       WHERE workforce_id = ? AND attendance_date BETWEEN ? AND ?`,
      [workforceId, start, end]
    );

    return summary[0];
  }
}

module.exports = AttendanceService;
