const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { ApiError } = require("../middleware/errorHandler");

/**
 * OnboardingService
 * Manages onboarding checklists, mandatory verification gates,
 * user login account provisioning, and profile activation.
 */
class OnboardingService {
  /**
   * Get onboarding checklist for workforce member
   */
  static async getChecklist(workforceId) {
    const [items] = await pool.query(
      `SELECT obc.*, 
              u.email AS completed_by_email,
              u.first_name AS completed_by_first_name,
              u.last_name AS completed_by_last_name
       FROM workforce_onboarding_checklists obc
       LEFT JOIN users u ON obc.completed_by = u.id
       WHERE obc.workforce_id = ?
       ORDER BY obc.mandatory DESC, obc.id ASC`,
      [workforceId]
    );

    const [summary] = await pool.query(
      `SELECT 
        COUNT(*) AS total_items,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_items,
        SUM(CASE WHEN mandatory = TRUE AND status NOT IN ('COMPLETED', 'WAIVED') THEN 1 ELSE 0 END) AS pending_mandatory
       FROM workforce_onboarding_checklists
       WHERE workforce_id = ?`,
      [workforceId]
    );

    return {
      items,
      summary: summary[0],
    };
  }

  /**
   * Update checklist item
   */
  static async updateChecklistItem(itemId, data, currentUserId) {
    const [items] = await pool.query(
      `SELECT * FROM workforce_onboarding_checklists WHERE id = ?`,
      [itemId]
    );
    if (items.length === 0) {
      throw new ApiError(404, "Checklist item not found.");
    }

    const isCompleted = data.status === "COMPLETED";

    await pool.query(
      `UPDATE workforce_onboarding_checklists
       SET status = ?, 
           remarks = ?, 
           completed_at = ?,
           completed_by = ?
       WHERE id = ?`,
      [
        data.status,
        data.remarks || null,
        isCompleted ? new Date() : (data.status === "WAIVED" ? new Date() : null),
        isCompleted || data.status === "WAIVED" ? currentUserId : null,
        itemId,
      ]
    );

    return { id: itemId, status: data.status };
  }

  /**
   * Add custom checklist item
   */
  static async addChecklistItem(workforceId, data) {
    const [res] = await pool.query(
      `INSERT INTO workforce_onboarding_checklists
       (workforce_id, title, category, mandatory, due_date, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        workforceId,
        data.title,
        data.category || "DOCUMENTS",
        data.mandatory !== undefined ? data.mandatory : true,
        data.due_date || null,
        data.remarks || null,
      ]
    );

    return { id: res.insertId, title: data.title };
  }

  /**
   * Complete onboarding and activate workforce member with user account provisioning
   */
  static async completeOnboardingAndActivate(workforceId, options = {}, user) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [profiles] = await conn.query(
        `SELECT wp.*, c.first_name, c.last_name, c.email
         FROM workforce_profiles wp
         JOIN contacts c ON wp.contact_id = c.id
         WHERE wp.id = ? FOR UPDATE`,
        [workforceId]
      );

      if (profiles.length === 0) {
        throw new ApiError(404, "Workforce profile not found.");
      }
      const profile = profiles[0];

      // Check mandatory items
      const [pendingMandatory] = await conn.query(
        `SELECT COUNT(*) AS pending 
         FROM workforce_onboarding_checklists 
         WHERE workforce_id = ? AND mandatory = TRUE AND status NOT IN ('COMPLETED', 'WAIVED')`,
        [workforceId]
      );

      if (pendingMandatory[0].pending > 0) {
        if (user.role !== "OWNER") {
          throw new ApiError(
            400,
            `Cannot activate: ${pendingMandatory[0].pending} mandatory checklist items are still incomplete. Owner override required.`
          );
        }
      }

      // Provision or link user account if requested or if user_id is null
      let userId = profile.user_id;
      if (!userId && options.create_user_account !== false) {
        const userEmail = options.email || profile.email;

        // Check if user already exists
        const [existingUsers] = await conn.query(
          `SELECT id FROM users WHERE email = ?`,
          [userEmail]
        );

        if (existingUsers.length > 0) {
          userId = existingUsers[0].id;
        } else {
          // Create new user with provided password or cryptographically random temporary password
          const initialPassword = options.password || `${crypto.randomBytes(16).toString("hex")}!Aa1`;
          const passwordHash = await bcrypt.hash(initialPassword, 12);

          const [newUser] = await conn.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, status)
             VALUES (?, ?, ?, ?, 'ACTIVE')`,
            [profile.first_name || "Member", profile.last_name || "", userEmail, passwordHash]
          );
          userId = newUser.insertId;

          // Assign role based on workforce type
          let roleName = "JUNIOR_ASSOCIATE";
          if (profile.workforce_type.includes("INTERN")) {
            roleName = "INTERN";
          } else if (profile.workforce_type === "CONTRACTOR") {
            roleName = "JUNIOR_ASSOCIATE";
          }

          const [roleRows] = await conn.query(
            `SELECT id FROM roles WHERE name = ?`,
            [options.role || roleName]
          );

          if (roleRows.length > 0) {
            await conn.query(
              `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`,
              [userId, roleRows[0].id]
            );
          }
        }

        // Link user to workforce profile
        await conn.query(
          `UPDATE workforce_profiles SET user_id = ? WHERE id = ?`,
          [userId, workforceId]
        );
      }

      // Activate profile
      await conn.query(
        `UPDATE workforce_profiles 
         SET status = 'ACTIVE', notes = CONCAT(COALESCE(notes, ''), '\n[Activated on Onboarding Completion by User #', ?, ']')
         WHERE id = ?`,
        [user.id, workforceId]
      );

      // If intern, update internship_records
      if (profile.workforce_type.includes("INTERN")) {
        await conn.query(
          `UPDATE internship_records SET internship_status = 'ACTIVE' WHERE workforce_id = ?`,
          [workforceId]
        );
      }

      // Allocate initial yearly leave balances
      const currentYear = new Date().getFullYear();
      const [leaveTypes] = await conn.query(
        `SELECT id, default_days_per_year, applicable_to 
         FROM workforce_leave_types 
         WHERE active = TRUE`
      );

      for (const lt of leaveTypes) {
        const isIntern = profile.workforce_type.includes("INTERN");
        if (
          lt.applicable_to === "ALL" ||
          (isIntern && lt.applicable_to === "INTERN_ONLY") ||
          (!isIntern && lt.applicable_to === "EMPLOYEE_ONLY")
        ) {
          await conn.query(
            `INSERT IGNORE INTO workforce_leave_balances
             (workforce_id, leave_type_id, year, opening_balance, allocated, remaining)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              workforceId,
              lt.id,
              currentYear,
              lt.default_days_per_year,
              lt.default_days_per_year,
              lt.default_days_per_year,
            ]
          );
        }
      }

      await conn.commit();
      return {
        workforce_id: workforceId,
        status: "ACTIVE",
        user_id: userId,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = OnboardingService;
