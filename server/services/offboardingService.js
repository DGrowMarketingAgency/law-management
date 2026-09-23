const pool = require("../config/database");
const WorkforceCodeService = require("./workforceCodeService");
const { ApiError } = require("../middleware/errorHandler");

/**
 * OffboardingService
 * Handles resignation/exit requests, handover delegations,
 * offboarding checklists, certificate generation, and full access revocation.
 */
class OffboardingService {
  /**
   * Submit exit / resignation request
   */
  static async submitExitRequest(workforceId, data) {
    const [existing] = await pool.query(
      `SELECT * FROM workforce_exit_requests WHERE workforce_id = ?`,
      [workforceId]
    );
    if (existing.length > 0 && existing[0].status !== "CANCELLED" && existing[0].status !== "REJECTED") {
      throw new ApiError(400, "An active exit request is already in progress for this member.");
    }

    const [res] = await pool.query(
      `INSERT INTO workforce_exit_requests
       (workforce_id, exit_type, requested_date, proposed_last_working_date, reason, notice_period_days, status)
       VALUES (?, ?, ?, ?, ?, ?, 'REQUESTED')
       ON DUPLICATE KEY UPDATE
         exit_type = VALUES(exit_type),
         requested_date = VALUES(requested_date),
         proposed_last_working_date = VALUES(proposed_last_working_date),
         reason = VALUES(reason),
         notice_period_days = VALUES(notice_period_days),
         status = 'REQUESTED'`,
      [
        workforceId,
        data.exit_type || "RESIGNATION",
        data.requested_date || new Date().toISOString().slice(0, 10),
        data.proposed_last_working_date,
        data.reason,
        data.notice_period_days || 30,
      ]
    );

    // Populate default offboarding checklist
    await this.seedDefaultOffboardingChecklist(workforceId);

    return { id: res.insertId || existing[0]?.id, status: "REQUESTED" };
  }

  /**
   * Seed default offboarding checklist
   */
  static async seedDefaultOffboardingChecklist(workforceId) {
    const items = [
      ["Formal Exit Request Approval", "EXIT_APPROVAL", true],
      ["Case Files & Precedent Handover", "HANDOVER", true],
      ["Pending Tasks Reassignment", "CASE_REASSIGNMENT", true],
      ["Firm Physical & IT Asset Return", "ASSET_RETURN", true],
      ["Final Payroll / Stipend Settlement", "PAYMENT_SETTLEMENT", true],
      ["IT Credentials & Access Revocation", "ACCESS_REVOCATION", true],
      ["Exit Interview & Chambers Feedback", "EXIT_INTERVIEW", false],
    ];

    for (const [title, category, mandatory] of items) {
      await pool.query(
        `INSERT IGNORE INTO workforce_offboarding_checklists
         (workforce_id, title, category, mandatory, status)
         VALUES (?, ?, ?, ?, 'PENDING')`,
        [workforceId, title, category, mandatory]
      );
    }
  }

  /**
   * Get offboarding status for a workforce member
   */
  static async getOffboardingDetails(workforceId) {
    const [exitReqs] = await pool.query(
      `SELECT wex.*, 
              approver.first_name AS approver_first_name,
              approver.last_name AS approver_last_name
       FROM workforce_exit_requests wex
       LEFT JOIN users approver ON wex.approved_by = approver.id
       WHERE wex.workforce_id = ?`,
      [workforceId]
    );

    const [checklists] = await pool.query(
      `SELECT * FROM workforce_offboarding_checklists WHERE workforce_id = ? ORDER BY id ASC`,
      [workforceId]
    );

    const [handovers] = await pool.query(
      `SELECT who.*, 
              target.first_name AS target_first_name,
              target.last_name AS target_last_name,
              c.case_number,
              c.title AS case_title,
              wt.title AS task_title
       FROM workforce_handover_items who
       JOIN users target ON who.target_user_id = target.id
       LEFT JOIN cases c ON who.case_id = c.id
       LEFT JOIN workforce_tasks wt ON who.task_id = wt.id
       WHERE who.workforce_id = ?
       ORDER BY who.due_date ASC`,
      [workforceId]
    );

    return {
      exitRequest: exitReqs[0] || null,
      checklists,
      handovers,
    };
  }

  /**
   * Process exit request (Approve/Reject)
   */
  static async processExitRequest(workforceId, action, data = {}, currentUserId) {
    const isApproved = action === "APPROVE";

    await pool.query(
      `UPDATE workforce_exit_requests
       SET status = ?,
           approved_by = ?,
           approved_at = NOW(),
           actual_last_working_date = ?,
           rejection_reason = ?
       WHERE workforce_id = ?`,
      [
        isApproved ? "APPROVED" : "REJECTED",
        currentUserId,
        isApproved ? (data.actual_last_working_date || data.proposed_last_working_date || null) : null,
        isApproved ? null : (data.rejection_reason || "Exit rejected"),
        workforceId,
      ]
    );

    if (isApproved) {
      await pool.query(
        `UPDATE workforce_profiles SET status = 'ON_NOTICE' WHERE id = ?`,
        [workforceId]
      );
    }

    return { workforce_id: workforceId, status: isApproved ? "APPROVED" : "REJECTED" };
  }

  /**
   * Create handover item (Case or Task handover)
   */
  static async createHandoverItem(workforceId, data, currentUserId) {
    const [res] = await pool.query(
      `INSERT INTO workforce_handover_items
       (workforce_id, target_user_id, case_id, task_id, title, description, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        workforceId,
        data.target_user_id,
        data.case_id || null,
        data.task_id || null,
        data.title,
        data.description || null,
        data.due_date,
      ]
    );

    // If task_id provided, reassign workforce_task to target_user_id
    if (data.task_id) {
      await pool.query(
        `UPDATE workforce_tasks SET assigned_to = ? WHERE id = ?`,
        [data.target_user_id, data.task_id]
      );
    }

    return { id: res.insertId, status: "PENDING" };
  }

  /**
   * Update offboarding checklist item
   */
  static async updateOffboardingChecklistItem(itemId, data, currentUserId) {
    await pool.query(
      `UPDATE workforce_offboarding_checklists
       SET status = ?, 
           completed_at = ?,
           completed_by = ?,
           remarks = ?
       WHERE id = ?`,
      [
        data.status,
        data.status === "COMPLETED" ? new Date() : null,
        data.status === "COMPLETED" ? currentUserId : null,
        data.remarks || null,
        itemId,
      ]
    );

    return { id: itemId, status: data.status };
  }

  /**
   * Revocation Engine: Execute full access revocation and finalize exit
   */
  static async executeFullRevocationAndExit(workforceId, currentUserId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [profiles] = await conn.query(
        `SELECT * FROM workforce_profiles WHERE id = ? FOR UPDATE`,
        [workforceId]
      );

      if (profiles.length === 0) {
        throw new ApiError(404, "Workforce profile not found.");
      }
      const profile = profiles[0];

      const userId = profile.user_id;

      if (userId) {
        // 1. Invalidate all active refresh tokens for this user
        await conn.query(`DELETE FROM refresh_tokens WHERE user_id = ?`, [userId]);

        // 2. Set user as inactive/disabled
        await conn.query(`UPDATE users SET status = 'INACTIVE' WHERE id = ?`, [userId]);

        // 3. Clear or reassign active case assignments
        await conn.query(
          `DELETE FROM case_assignments WHERE user_id = ?`,
          [userId]
        );
      }

      // 4. Update workforce profile status to EXITED or COMPLETED
      const finalStatus = profile.workforce_type.includes("INTERN") ? "COMPLETED" : "EXITED";
      await conn.query(
        `UPDATE workforce_profiles 
         SET status = ?, actual_end_date = CURDATE(), 
             notes = CONCAT(COALESCE(notes, ''), '\n[Access Revoked & Exited by User #', ?, ' on ', NOW(), ']')
         WHERE id = ?`,
        [finalStatus, currentUserId, workforceId]
      );

      // 5. If intern, update internship_records
      if (profile.workforce_type.includes("INTERN")) {
        await conn.query(
          `UPDATE internship_records 
           SET internship_status = 'COMPLETED', actual_end_date = CURDATE(), certificate_status = 'ELIGIBLE' 
           WHERE workforce_id = ?`,
          [workforceId]
        );
      }

      // 6. Mark access revocation checklist item completed
      await conn.query(
        `UPDATE workforce_offboarding_checklists
         SET status = 'COMPLETED', completed_at = NOW(), completed_by = ?
         WHERE workforce_id = ? AND category = 'ACCESS_REVOCATION'`,
        [currentUserId, workforceId]
      );

      // 7. Mark exit request as completed
      await conn.query(
        `UPDATE workforce_exit_requests SET status = 'COMPLETED' WHERE workforce_id = ?`,
        [workforceId]
      );

      await conn.commit();
      return {
        workforce_id: workforceId,
        status: finalStatus,
        access_revoked: true,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Generate and issue internship completion certificate
   */
  static async issueInternshipCertificate(workforceId, currentUserId) {
    const [rows] = await pool.query(
      `SELECT inr.*, wp.workforce_code, c.first_name, c.last_name, inr.college_institution
       FROM internship_records inr
       JOIN workforce_profiles wp ON inr.workforce_id = wp.id
       JOIN contacts c ON wp.contact_id = c.id
       WHERE inr.workforce_id = ?`,
      [workforceId]
    );

    if (rows.length === 0) {
      throw new ApiError(404, "Internship record not found.");
    }
    const intern = rows[0];

    const certCode = await WorkforceCodeService.generateCertificateCode();

    await pool.query(
      `UPDATE internship_records
       SET certificate_status = 'ISSUED',
           certificate_number = ?,
           certificate_issued_at = NOW()
       WHERE workforce_id = ?`,
      [certCode, workforceId]
    );

    return {
      workforce_id: workforceId,
      certificate_number: certCode,
      certificate_status: "ISSUED",
      member_name: `${intern.first_name} ${intern.last_name}`.trim(),
      institution: intern.college_institution,
      start_date: intern.start_date,
      end_date: intern.actual_end_date || intern.planned_end_date,
    };
  }
}

module.exports = OffboardingService;
