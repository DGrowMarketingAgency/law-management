const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const env = require("../config/env");
const WorkforceCodeService = require("./workforceCodeService");
const WorkforceSecurityService = require("./workforceSecurityService");
const { ApiError } = require("../middleware/errorHandler");
const { logAuthEvent } = require("./auditService");
const centralEmailService = require("./email/emailService");
const emailSecurityService = require("./email/emailSecurityService");
const { hashToken } = require("../utils/token");

/**
 * WorkforceService
 * Manages workforce profiles, directory listings, lifecycle status machine,
 * and integration with contacts, users, and audit logs.
 */
class WorkforceService {
  /**
   * Get filtered workforce directory
   */
  static async getDirectory(filters = {}, requestingUser) {
    const {
      search,
      workforce_type,
      status,
      department,
      page = 1,
      limit = 20,
    } = filters;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let whereClause = "WHERE 1=1";

    if (search) {
      whereClause += ` AND (
        wp.workforce_code LIKE ? OR 
        c.first_name LIKE ? OR 
        c.last_name LIKE ? OR 
        c.email LIKE ? OR 
        c.phone LIKE ? OR
        wp.designation LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }

    if (workforce_type) {
      whereClause += " AND wp.workforce_type = ?";
      params.push(workforce_type);
    }

    if (status) {
      whereClause += " AND wp.status = ?";
      params.push(status);
    }

    if (department) {
      whereClause += " AND wp.department = ?";
      params.push(department);
    }

    // Total count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM workforce_profiles wp
       JOIN contacts c ON wp.contact_id = c.id
       ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // Fetch records
    const [rows] = await pool.query(
      `SELECT 
        wp.id,
        wp.workforce_code,
        wp.workforce_type,
        wp.designation,
        wp.department,
        wp.status,
        wp.joining_date,
        wp.expected_end_date,
        wp.actual_end_date,
        wp.work_location,
        wp.employment_mode,
        wp.contact_id,
        wp.user_id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        u.email AS user_email,
        u.status AS user_status,
        r.name AS user_role,
        mgr.first_name AS manager_first_name,
        mgr.last_name AS manager_last_name,
        inr.internship_type,
        inr.college_institution,
        inr.stipend_enabled,
        inr.stipend_amount,
        (
          SELECT COUNT(*) 
          FROM workforce_onboarding_checklists obc 
          WHERE obc.workforce_id = wp.id AND obc.status != 'COMPLETED' AND obc.mandatory = TRUE
        ) AS pending_mandatory_onboarding
       FROM workforce_profiles wp
       JOIN contacts c ON wp.contact_id = c.id
       LEFT JOIN users u ON wp.user_id = u.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       LEFT JOIN users mgr ON wp.reporting_manager_user_id = mgr.id
       LEFT JOIN internship_records inr ON wp.id = inr.workforce_id
       ${whereClause}
       ORDER BY wp.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return {
      profiles: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    };
  }

  /**
   * Get single workforce profile by ID with related records
   */
  static async getProfileById(id, requestingUser) {
    const [profiles] = await pool.query(
      `SELECT 
        wp.*,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.alternate_phone,
        u.email AS user_email,
        u.status AS user_status,
        u.two_factor_enabled AS user_2fa_enabled,
        CASE WHEN u.status = 'ACTIVE' THEN 1 ELSE 0 END AS user_active,
        r.name AS user_role,
        mgr.first_name AS manager_first_name,
        mgr.last_name AS manager_last_name
       FROM workforce_profiles wp
       JOIN contacts c ON wp.contact_id = c.id
       LEFT JOIN users u ON wp.user_id = u.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       LEFT JOIN users mgr ON wp.reporting_manager_user_id = mgr.id
       WHERE wp.id = ?`,
      [id]
    );

    if (profiles.length === 0) {
      throw new ApiError(404, "Workforce member not found.");
    }

    const profile = profiles[0];

    // Privacy Guard: If INTERN or JUNIOR_ASSOCIATE, ensure they only view their own profile
    if (
      ["INTERN", "JUNIOR_ASSOCIATE"].includes(requestingUser.role) &&
      profile.user_id !== requestingUser.id
    ) {
      throw new ApiError(403, "Access denied. You can only view your own profile.");
    }

    // Fetch employment record if applicable
    let employmentRecord = null;
    if (["EMPLOYEE", "CONTRACTOR"].includes(profile.workforce_type)) {
      const [empRows] = await pool.query(
        `SELECT * FROM workforce_employment_records WHERE workforce_id = ?`,
        [id]
      );
      employmentRecord = empRows[0] || null;
    }

    // Fetch internship record if intern
    let internshipRecord = null;
    if (["PAID_INTERN", "UNPAID_INTERN"].includes(profile.workforce_type)) {
      const [intRows] = await pool.query(
        `SELECT inr.*, 
                mentor.first_name AS mentor_first_name, 
                mentor.last_name AS mentor_last_name
         FROM internship_records inr
         LEFT JOIN users mentor ON inr.mentor_user_id = mentor.id
         WHERE inr.workforce_id = ?`,
        [id]
      );
      internshipRecord = intRows[0] || null;
    }

    // Fetch masked bank account (Only if authorized role or self)
    let bankAccount = null;
    const canViewBank =
      ["OWNER", "HR_ADMIN", "ACCOUNTS"].includes(requestingUser.role) ||
      profile.user_id === requestingUser.id;

    if (canViewBank) {
      const [bankRows] = await pool.query(
        `SELECT id, account_holder_name, bank_name, account_number_masked, ifsc_masked, upi_id
         FROM workforce_bank_accounts
         WHERE workforce_id = ?`,
        [id]
      );
      bankAccount = bankRows[0] || null;
    }

    // Fetch salary structure (Strictly OWNER, ACCOUNTS, or HR_ADMIN viewing employee)
    let salaryStructure = null;
    const canViewSalary =
      ["OWNER", "ACCOUNTS"].includes(requestingUser.role) &&
      profile.workforce_type === "EMPLOYEE";

    if (canViewSalary) {
      const [salRows] = await pool.query(
        `SELECT * FROM employee_salary_structures 
         WHERE workforce_id = ? 
         ORDER BY id DESC LIMIT 1`,
        [id]
      );
      salaryStructure = salRows[0] || null;
    }

    // Fetch onboarding progress
    const [onboardingItems] = await pool.query(
      `SELECT * FROM workforce_onboarding_checklists WHERE workforce_id = ? ORDER BY id ASC`,
      [id]
    );

    // Fetch active tasks assigned
    const [activeTasks] = await pool.query(
      `SELECT wt.id, wt.task_code, wt.title, wt.task_type, wt.priority, wt.status, wt.due_date,
              c.case_number, c.title AS case_title
       FROM workforce_tasks wt
       LEFT JOIN cases c ON wt.related_case_id = c.id
       WHERE wt.assigned_to = ?
       ORDER BY wt.due_date ASC
       LIMIT 10`,
      [profile.user_id || 0]
    );

    // Fetch assigned cases
    const [assignedCases] = await pool.query(
      `SELECT ca.id, ca.role_in_case AS role, ca.created_at AS assigned_at, c.id AS case_id, c.case_number, c.title AS case_title, c.case_type, c.case_status AS status
       FROM case_assignments ca
       JOIN cases c ON ca.case_id = c.id
       WHERE ca.user_id = ?
       ORDER BY ca.created_at DESC`,
      [profile.user_id || 0]
    );

    return {
      profile,
      employmentRecord,
      internshipRecord,
      bankAccount,
      salaryStructure,
      onboardingItems,
      activeTasks,
      assignedCases,
    };
  }

  /**
   * Create new workforce profile
   */
  static async createProfile(data, createdByUserId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let contactId = data.contact_id;

      // If contact_id not provided, create new contact
      if (!contactId) {
        if (!data.first_name || !data.email || !data.phone) {
          throw new ApiError(400, "First name, email, and phone are required to create a workforce member.");
        }
        const displayName = `${data.first_name} ${data.last_name || ""}`.trim();
        const [contactRes] = await conn.query(
          `INSERT INTO contacts (display_name, first_name, last_name, email, phone, contact_type)
           VALUES (?, ?, ?, ?, ?, 'OTHER')`,
          [displayName, data.first_name, data.last_name || "", data.email, data.phone]
        );
        contactId = contactRes.insertId;
      }

      // Determine code prefix
      let prefix = "EMP";
      if (data.workforce_type === "PAID_INTERN" || data.workforce_type === "UNPAID_INTERN") {
        prefix = "INT";
      } else if (data.workforce_type === "CONTRACTOR") {
        prefix = "CON";
      }

      const workforceCode = await WorkforceCodeService.generateCode(
        prefix,
        "workforce_profiles",
        "workforce_code",
        conn
      );

      // Insert workforce profile
      const [wfRes] = await conn.query(
        `INSERT INTO workforce_profiles 
         (contact_id, workforce_code, workforce_type, designation, department, 
          reporting_manager_user_id, joining_date, expected_end_date, status, 
          work_location, employment_mode, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ONBOARDING', ?, ?, ?)`,
        [
          contactId,
          workforceCode,
          data.workforce_type,
          data.designation || (data.workforce_type.includes("INTERN") ? "Legal Intern" : "Legal Associate"),
          data.department || "Litigation & Dispute Resolution",
          data.reporting_manager_user_id || null,
          data.joining_date || new Date().toISOString().slice(0, 10),
          data.expected_end_date || null,
          data.work_location || "Main Chambers",
          data.employment_mode || (data.workforce_type.includes("INTERN") ? "INTERNSHIP" : "FULL_TIME"),
          data.notes || null,
        ]
      );
      const workforceId = wfRes.insertId;

      // If Employee or Contractor, insert employment record
      if (["EMPLOYEE", "CONTRACTOR"].includes(data.workforce_type)) {
        await conn.query(
          `INSERT INTO workforce_employment_records
           (workforce_id, probation_period_days, notice_period_days, emergency_contact_name, emergency_contact_phone, blood_group)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            workforceId,
            data.probation_period_days || 90,
            data.notice_period_days || 30,
            data.emergency_contact_name || null,
            data.emergency_contact_phone || null,
            data.blood_group || null,
          ]
        );
      }

      // If Intern, insert internship record
      if (["PAID_INTERN", "UNPAID_INTERN"].includes(data.workforce_type)) {
        const isPaid = data.workforce_type === "PAID_INTERN";
        const stipendAmount = isPaid ? parseFloat(data.stipend_amount || 0) : 0.0;

        await conn.query(
          `INSERT INTO internship_records
           (workforce_id, internship_code, internship_type, college_institution, course, 
            specialization, mentor_user_id, start_date, planned_end_date, duration_weeks, 
            stipend_enabled, stipend_amount, stipend_frequency, internship_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ONBOARDING')`,
          [
            workforceId,
            workforceCode,
            isPaid ? "PAID" : "UNPAID",
            data.college_institution || "Law Faculty",
            data.course || "LL.B / B.A. LL.B",
            data.specialization || "General Litigation",
            data.mentor_user_id || data.reporting_manager_user_id || null,
            data.joining_date || new Date().toISOString().slice(0, 10),
            data.expected_end_date || new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10),
            data.duration_weeks || 8,
            isPaid,
            stipendAmount,
            isPaid ? (data.stipend_frequency || "MONTHLY") : "NONE",
          ]
        );
      }

      // Generate default onboarding checklist items
      await this.generateDefaultOnboardingChecklist(workforceId, data.workforce_type, conn);

      await conn.commit();
      return { id: workforceId, workforce_code: workforceCode };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Helper to seed standard onboarding checklist based on type
   */
  static async generateDefaultOnboardingChecklist(workforceId, type, conn) {
    const isIntern = type.includes("INTERN");

    const commonItems = [
      ["Government ID Verification (Aadhaar / Passport)", "DOCUMENTS", true],
      ["Bar Council Enrollment or College ID Verification", "DOCUMENTS", true],
      ["Confidentiality & Non-Disclosure Agreement (NDA)", "AGREEMENTS", true],
      ["Chambers Code of Conduct & Ethics Acknowledgement", "AGREEMENTS", true],
      ["IT & Case Management Access Setup", "IT_ACCESS", true],
      ["Chambers Library & Precedents Orientation", "ORIENTATION", false],
      ["Emergency Contact & Blood Group Verification", "EMERGENCY", true],
    ];

    const employeeOnlyItems = [
      ["Relieving Letter & Past Experience Verification", "DOCUMENTS", true],
      ["Bank Account Details for Payroll", "PERSONAL", true],
      ["Tax / PAN Verification", "DOCUMENTS", true],
      ["Chambers Asset Issuance (Laptop / Access Badge)", "IT_ACCESS", false],
    ];

    const internOnlyItems = [
      ["College NOC / Recommendation Letter", "DOCUMENTS", true],
      ["Internship Duration & Mentor Alignment", "ORIENTATION", true],
      [type === "PAID_INTERN" ? "Bank Account for Stipend" : "Unpaid Internship Acknowledgement", "PERSONAL", true],
    ];

    const targetList = [
      ...commonItems,
      ...(isIntern ? internOnlyItems : employeeOnlyItems),
    ];

    for (const [title, category, mandatory] of targetList) {
      await conn.query(
        `INSERT INTO workforce_onboarding_checklists
         (workforce_id, title, category, mandatory, status)
         VALUES (?, ?, ?, ?, 'PENDING')`,
        [workforceId, title, category, mandatory]
      );
    }
  }

  /**
   * Update workforce profile
   */
  /**
   * Update workforce profile, linked contact, linked user, and employment details
   */
  static async updateProfile(id, data, user = {}, ip = null, userAgent = null) {
    const requestingUser = typeof user === "object" && user !== null ? user : { id: user, role: "OWNER" };
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [profiles] = await conn.query(
        `SELECT wp.*, c.id as contact_id, c.first_name, c.last_name, c.email as contact_email, c.phone as contact_phone,
                u.id as linked_user_id, u.email as user_email
         FROM workforce_profiles wp
         JOIN contacts c ON wp.contact_id = c.id
         LEFT JOIN users u ON wp.user_id = u.id
         WHERE wp.id = ? FOR UPDATE`,
        [id]
      );
      if (profiles.length === 0) {
        throw new ApiError(404, "Workforce member not found.");
      }
      const profile = profiles[0];

      // 1. Email uniqueness check if email is modified
      const newEmail = data.email !== undefined ? String(data.email).trim().toLowerCase() : null;
      if (newEmail && newEmail !== profile.contact_email?.toLowerCase()) {
        const [existingContacts] = await conn.query(
          `SELECT id FROM contacts WHERE email = ? AND id != ? AND deleted_at IS NULL`,
          [newEmail, profile.contact_id]
        );
        if (existingContacts.length > 0) {
          throw new ApiError(409, "A contact with this email address already exists.");
        }

        if (profile.linked_user_id) {
          const [existingUsers] = await conn.query(
            `SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL`,
            [newEmail, profile.linked_user_id]
          );
          if (existingUsers.length > 0) {
            throw new ApiError(409, "A user account with this email address already exists.");
          }
        }
      }

      // 2. Update contacts table
      const contactUpdates = [];
      const contactParams = [];
      if (data.first_name !== undefined) {
        contactUpdates.push("first_name = ?");
        contactParams.push(String(data.first_name).trim());
      }
      if (data.last_name !== undefined) {
        contactUpdates.push("last_name = ?");
        contactParams.push(String(data.last_name).trim());
      }
      if (data.first_name !== undefined || data.last_name !== undefined) {
        const fn = data.first_name !== undefined ? String(data.first_name).trim() : profile.first_name;
        const ln = data.last_name !== undefined ? String(data.last_name).trim() : profile.last_name;
        contactUpdates.push("display_name = ?");
        contactParams.push(`${fn} ${ln}`.trim());
      }
      if (newEmail) {
        contactUpdates.push("email = ?");
        contactParams.push(newEmail);
      }
      if (data.phone !== undefined) {
        contactUpdates.push("phone = ?");
        contactParams.push(String(data.phone).trim());
      }
      if (data.alternate_phone !== undefined) {
        contactUpdates.push("alternate_phone = ?");
        contactParams.push(data.alternate_phone ? String(data.alternate_phone).trim() : null);
      }

      if (contactUpdates.length > 0) {
        contactParams.push(profile.contact_id);
        await conn.query(
          `UPDATE contacts SET ${contactUpdates.join(", ")}, updated_at = NOW() WHERE id = ?`,
          contactParams
        );
      }

      // 3. Update linked user account if exists
      if (profile.linked_user_id) {
        const userUpdates = [];
        const userParams = [];
        if (data.first_name !== undefined) {
          userUpdates.push("first_name = ?");
          userParams.push(String(data.first_name).trim());
        }
        if (data.last_name !== undefined) {
          userUpdates.push("last_name = ?");
          userParams.push(String(data.last_name).trim());
        }
        if (newEmail) {
          userUpdates.push("email = ?");
          userParams.push(newEmail);
        }
        if (data.phone !== undefined) {
          userUpdates.push("phone = ?");
          userParams.push(String(data.phone).trim());
        }
        if (userUpdates.length > 0) {
          userParams.push(profile.linked_user_id);
          await conn.query(
            `UPDATE users SET ${userUpdates.join(", ")}, updated_at = NOW() WHERE id = ?`,
            userParams
          );
        }
      }

      // 4. Update workforce_profiles table (immutable: workforce_code, user_id, id)
      const allowedWpFields = [
        "workforce_type",
        "designation",
        "department",
        "reporting_manager_user_id",
        "joining_date",
        "expected_end_date",
        "actual_end_date",
        "work_location",
        "employment_mode",
        "notes"
      ];
      const wpUpdates = [];
      const wpParams = [];
      for (const field of allowedWpFields) {
        if (data[field] !== undefined) {
          wpUpdates.push(`${field} = ?`);
          wpParams.push(data[field] === "" ? null : data[field]);
        }
      }
      if (wpUpdates.length > 0) {
        wpParams.push(id);
        await conn.query(
          `UPDATE workforce_profiles SET ${wpUpdates.join(", ")}, updated_at = NOW() WHERE id = ?`,
          wpParams
        );
      }

      // 5. Update workforce_employment_records
      const allowedEmpFields = [
        "probation_period_days",
        "confirmation_date",
        "notice_period_days",
        "contract_signed_date",
        "emergency_contact_name",
        "emergency_contact_phone",
        "emergency_contact_relation",
        "blood_group"
      ];
      const empUpdates = [];
      const empParams = [];
      for (const field of allowedEmpFields) {
        if (data[field] !== undefined) {
          empUpdates.push(`${field} = ?`);
          empParams.push(data[field] === "" ? null : data[field]);
        }
      }
      if (empUpdates.length > 0) {
        const [existingWer] = await conn.query(
          `SELECT id FROM workforce_employment_records WHERE workforce_id = ?`,
          [id]
        );
        if (existingWer.length > 0) {
          empParams.push(id);
          await conn.query(
            `UPDATE workforce_employment_records SET ${empUpdates.join(", ")}, updated_at = NOW() WHERE workforce_id = ?`,
            empParams
          );
        } else {
          await conn.query(
            `INSERT INTO workforce_employment_records (workforce_id, ${empUpdates.map(u => u.split(" ")[0]).join(", ")})
             VALUES (?, ${empUpdates.map(() => "?").join(", ")})`,
            [id, ...empParams]
          );
        }
      }

      await conn.commit();

      if (requestingUser.id) {
        await logAuthEvent(requestingUser.id, "WORKFORCE_UPDATED", ip, userAgent, {
          workforceId: id,
          workforceCode: profile.workforce_code,
          updatedFields: Object.keys(data).filter(k => !["password", "initialPassword"].includes(k))
        });
      }

      const updated = await this.getProfileById(id, requestingUser);
      return { success: true, ...updated };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Activate workforce profile and provision/activate user login
   */
  static async activateProfile(id, user, options = {}, ip = null, userAgent = null) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [profiles] = await conn.query(
        `SELECT wp.*, c.first_name, c.last_name, c.email, c.phone, u.id as linked_user_id, u.status as user_status
         FROM workforce_profiles wp
         JOIN contacts c ON wp.contact_id = c.id
         LEFT JOIN users u ON wp.user_id = u.id
         WHERE wp.id = ? FOR UPDATE`,
        [id]
      );
      if (profiles.length === 0) {
        throw new ApiError(404, "Workforce member not found.");
      }
      const profile = profiles[0];

      // Check mandatory onboarding checklist items
      const [pendingMandatory] = await conn.query(
        `SELECT COUNT(*) AS pending 
         FROM workforce_onboarding_checklists 
         WHERE workforce_id = ? AND mandatory = TRUE AND status NOT IN ('COMPLETED', 'WAIVED')`,
        [id]
      );

      const isOwner = user.role === "OWNER" || (user.roles && user.roles.includes("OWNER"));
      if (pendingMandatory[0].pending > 0 && !isOwner) {
        throw new ApiError(
          400,
          `Cannot activate: ${pendingMandatory[0].pending} mandatory onboarding checklist item(s) are incomplete. Owner override required.`
        );
      }

      let userId = profile.linked_user_id;

      // Provision user account if missing
      if (!userId && options.create_user_account !== false) {
        const userEmail = String(options.email || profile.email).trim().toLowerCase();

        const [existingUsers] = await conn.query(
          `SELECT id, status FROM users WHERE email = ?`,
          [userEmail]
        );

        if (existingUsers.length > 0) {
          userId = existingUsers[0].id;
          await conn.query(`UPDATE users SET status = 'ACTIVE' WHERE id = ?`, [userId]);
        } else {
          const initialPassword = options.password || `${crypto.randomBytes(16).toString("hex")}!Aa1`;
          const passwordHash = await bcrypt.hash(initialPassword, 12);

          const [newUser] = await conn.query(
            `INSERT INTO users (first_name, last_name, email, phone, password_hash, status)
             VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
            [profile.first_name || "Member", profile.last_name || "", userEmail, profile.phone || null, passwordHash]
          );
          userId = newUser.insertId;

          let roleName = "JUNIOR_ASSOCIATE";
          if (profile.workforce_type.includes("INTERN")) {
            roleName = "INTERN";
          } else if (profile.workforce_type === "CONTRACTOR") {
            roleName = "JUNIOR_ASSOCIATE";
          }
          const [roleRows] = await conn.query(`SELECT id FROM roles WHERE name = ?`, [options.role || roleName]);
          if (roleRows.length > 0) {
            await conn.query(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, roleRows[0].id]);
          }
        }

        await conn.query(`UPDATE workforce_profiles SET user_id = ? WHERE id = ?`, [userId, id]);
      } else if (userId) {
        await conn.query(`UPDATE users SET status = 'ACTIVE' WHERE id = ?`, [userId]);
      }

      const prevStatus = profile.status;
      await conn.query(
        `UPDATE workforce_profiles 
         SET status = 'ACTIVE', notes = CONCAT(COALESCE(notes, ''), '\n[Activated by User #', ?, ' at ', NOW(), ']')
         WHERE id = ?`,
        [user.id, id]
      );

      if (profile.workforce_type.includes("INTERN")) {
        await conn.query(
          `UPDATE internship_records SET internship_status = 'ACTIVE' WHERE workforce_id = ?`,
          [id]
        );
      }

      await conn.commit();

      await logAuthEvent(user.id, "WORKFORCE_ACTIVATED", ip, userAgent, {
        workforceId: id,
        workforceCode: profile.workforce_code,
        previousStatus: prevStatus,
        newStatus: "ACTIVE",
        userId
      });

      return {
        success: true,
        id,
        status: "ACTIVE",
        user_id: userId,
        message: "Workforce member activated successfully."
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Deactivate employee and revoke login access
   */
  static async deactivateProfile(id, userOrReason = {}, reasonOrUser = "", ip = null, userAgent = null) {
    let user = typeof userOrReason === "object" && userOrReason !== null ? userOrReason : { id: 1, role: "OWNER" };
    let reason = typeof reasonOrUser === "string" ? reasonOrUser : (typeof userOrReason === "string" ? userOrReason : "");
    if (typeof reasonOrUser === "object" && reasonOrUser !== null) {
      user = reasonOrUser;
    }

    if (!reason || String(reason).trim().length === 0) {
      throw new ApiError(400, "Deactivation reason is required.");
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [profiles] = await conn.query(
        `SELECT wp.*, u.id as linked_user_id
         FROM workforce_profiles wp
         LEFT JOIN users u ON wp.user_id = u.id
         WHERE wp.id = ? FOR UPDATE`,
        [id]
      );
      if (profiles.length === 0) {
        throw new ApiError(404, "Workforce member not found.");
      }
      const profile = profiles[0];

      // Owner self-deactivation protection
      if (profile.linked_user_id && user.id && profile.linked_user_id === user.id) {
        throw new ApiError(403, "You cannot deactivate your own account.");
      }

      const dependencies = await this.getMemberDependencies(id, profile.linked_user_id, conn);

      const prevStatus = profile.status;
      await conn.query(
        `UPDATE workforce_profiles 
         SET status = 'INACTIVE', notes = CONCAT(COALESCE(notes, ''), '\n[Deactivated by User #', ?, ' (Reason: ', ?, ') at ', NOW(), ']')
         WHERE id = ?`,
        [user.id, String(reason).trim(), id]
      );

      if (profile.linked_user_id) {
        await conn.query(`UPDATE users SET status = 'INACTIVE' WHERE id = ?`, [profile.linked_user_id]);
        await conn.query(`DELETE FROM refresh_tokens WHERE user_id = ?`, [profile.linked_user_id]);
      }

      await conn.commit();

      await logAuthEvent(user.id, "WORKFORCE_DEACTIVATED", ip, userAgent, {
        workforceId: id,
        workforceCode: profile.workforce_code,
        previousStatus: prevStatus,
        newStatus: "INACTIVE",
        reason: String(reason).trim(),
        dependencies
      });

      return {
        success: true,
        id,
        status: "INACTIVE",
        message: "Workforce member deactivated and login access revoked successfully.",
        dependencies
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Restore inactive/suspended/exited employee back to ACTIVE
   */
  static async restoreProfile(id, userOrReason = {}, reasonOrUser = "", ip = null, userAgent = null) {
    let user = typeof userOrReason === "object" && userOrReason !== null ? userOrReason : { id: 1, role: "OWNER" };
    let reason = typeof reasonOrUser === "string" && reasonOrUser ? reasonOrUser : (typeof userOrReason === "string" && userOrReason ? userOrReason : "Restoration");
    if (typeof reasonOrUser === "object" && reasonOrUser !== null) {
      user = reasonOrUser;
    }

    const isOwner = user.role === "OWNER" || (user.roles && user.roles.includes("OWNER"));
    if (!isOwner && user.role !== "ADMIN" && user.role !== "HR_ADMIN") {
      throw new ApiError(403, "Restoration requires Owner or Admin authorization.");
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [profiles] = await conn.query(
        `SELECT wp.*, u.id as linked_user_id
         FROM workforce_profiles wp
         LEFT JOIN users u ON wp.user_id = u.id
         WHERE wp.id = ? FOR UPDATE`,
        [id]
      );
      if (profiles.length === 0) {
        throw new ApiError(404, "Workforce member not found.");
      }
      const profile = profiles[0];

      if (profile.status === "ACTIVE") {
        throw new ApiError(400, "Workforce member is already active.");
      }

      const prevStatus = profile.status;
      await conn.query(
        `UPDATE workforce_profiles 
         SET status = 'ACTIVE', notes = CONCAT(COALESCE(notes, ''), '\n[Restored by User #', ?, ' at ', NOW(), ']')
         WHERE id = ?`,
        [user.id, id]
      );

      if (profile.linked_user_id) {
        await conn.query(`UPDATE users SET status = 'ACTIVE' WHERE id = ?`, [profile.linked_user_id]);
      }

      await conn.commit();

      await logAuthEvent(user.id, "WORKFORCE_RESTORED", ip, userAgent, {
        workforceId: id,
        workforceCode: profile.workforce_code,
        previousStatus: prevStatus,
        newStatus: "ACTIVE",
        reason: String(reason || "Restoration").trim()
      });

      return {
        success: true,
        id,
        status: "ACTIVE",
        message: "Workforce member restored to ACTIVE status successfully."
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Check deletion safety and calculate historical dependencies
   */
  static async checkDeletionSafety(id) {
    const [profiles] = await pool.query(
      `SELECT wp.*, u.id as linked_user_id, c.display_name
       FROM workforce_profiles wp
       JOIN contacts c ON wp.contact_id = c.id
       LEFT JOIN users u ON wp.user_id = u.id
       WHERE wp.id = ?`,
      [id]
    );
    if (profiles.length === 0) {
      throw new ApiError(404, "Workforce member not found.");
    }
    const profile = profiles[0];
    const userId = profile.linked_user_id;

    let assignedCases = 0;
    let documents = 0;
    let billingEntries = 0;
    let tasks = 0;

    const [docRows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM documents WHERE workforce_id = ? OR (created_by = ? AND ? > 0)`,
      [id, userId || 0, userId || 0]
    );
    documents = docRows[0].cnt;

    if (userId) {
      const [caseRows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM case_assignments WHERE user_id = ?`,
        [userId]
      );
      assignedCases = caseRows[0].cnt;

      const [feeRows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM fee_entries WHERE created_by = ?`,
        [userId]
      );
      billingEntries = feeRows[0].cnt;

      const [taskRows] = await pool.query(
        `SELECT COUNT(*) as cnt FROM workforce_tasks WHERE assigned_to = ?`,
        [userId]
      );
      tasks = taskRows[0].cnt;
    }

    const [attRows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM workforce_attendance WHERE workforce_id = ?`,
      [id]
    );
    const attendanceRecords = attRows[0].cnt;

    const [leaveRows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM workforce_leave_requests WHERE workforce_id = ?`,
      [id]
    );
    const leaveRequests = leaveRows[0].cnt;

    const [salRows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM employee_salary_structures WHERE workforce_id = ?`,
      [id]
    );
    const salaryRecords = salRows[0].cnt;

    const counts = {
      assignedCases,
      documents,
      billingEntries,
      billing: billingEntries,
      attendanceRecords,
      attendance: attendanceRecords,
      tasks,
      leaveRequests,
      leaves: leaveRequests,
      salaryRecords
    };

    const hasHistoricalRecords = (
      assignedCases > 0 ||
      documents > 0 ||
      billingEntries > 0 ||
      attendanceRecords > 0 ||
      tasks > 0 ||
      leaveRequests > 0 ||
      salaryRecords > 0
    );

    const reasons = [];
    if (assignedCases > 0) reasons.push(`${assignedCases} assigned case(s)`);
    if (documents > 0) reasons.push(`${documents} legal document(s)`);
    if (billingEntries > 0) reasons.push(`${billingEntries} fee entry / billing record(s)`);
    if (attendanceRecords > 0) reasons.push(`${attendanceRecords} attendance record(s)`);
    if (tasks > 0) reasons.push(`${tasks} task(s)`);
    if (leaveRequests > 0) reasons.push(`${leaveRequests} leave record(s)`);

    return {
      workforceId: id,
      workforce_id: id,
      workforce_code: profile.workforce_code,
      member_name: profile.display_name,
      status: profile.status,
      canPermanentlyDelete: !hasHistoricalRecords,
      hasHistoricalRecords,
      reasons,
      counts
    };
  }

  /**
   * Safely archive or permanently delete employee based on dependency safety
   */
  static async deleteOrArchiveProfile(id, action, confirmationCode, user, ip = null, userAgent = null) {
    const safety = await this.checkDeletionSafety(id);

    if (action === "ARCHIVE") {
      const expectedConfirmation = `ARCHIVE ${safety.workforce_code}`;
      if (confirmationCode && confirmationCode.trim().toUpperCase() !== expectedConfirmation) {
        throw new ApiError(400, `Confirmation mismatch. Please type "${expectedConfirmation}" to proceed.`);
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.query(
          `UPDATE workforce_profiles 
           SET status = 'EXITED', notes = CONCAT(COALESCE(notes, ''), '\n[Archived by User #', ?, ' at ', NOW(), ']')
           WHERE id = ?`,
          [user.id, id]
        );

        const [wps] = await conn.query(`SELECT user_id FROM workforce_profiles WHERE id = ?`, [id]);
        if (wps[0]?.user_id) {
          await conn.query(`UPDATE users SET status = 'INACTIVE' WHERE id = ?`, [wps[0].user_id]);
          await conn.query(`DELETE FROM refresh_tokens WHERE user_id = ?`, [wps[0].user_id]);
        }

        await conn.commit();

        await logAuthEvent(user.id, "WORKFORCE_ARCHIVED", ip, userAgent, {
          workforceId: id,
          workforceCode: safety.workforce_code,
          counts: safety.counts
        });

        return {
          success: true,
          id,
          action: "ARCHIVE",
          status: "EXITED",
          message: `Member ${safety.workforce_code} has been securely archived. All legal, case, and audit records are preserved.`
        };
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    if (action === "PERMANENT_DELETE") {
      const isOwner = user.role === "OWNER" || (user.roles && user.roles.includes("OWNER"));
      if (!isOwner) {
        throw new ApiError(403, "Permanent deletion requires Owner permission.");
      }

      if (safety.hasHistoricalRecords) {
        throw new ApiError(
          400,
          `This member has historical records (${safety.reasons.join(", ")}) and cannot be permanently deleted. The account can be deactivated or archived.`
        );
      }

      const expectedConfirmation = `DELETE ${safety.workforce_code}`;
      if (confirmationCode && confirmationCode.trim().toUpperCase() !== expectedConfirmation) {
        throw new ApiError(400, `Confirmation mismatch. Please type "${expectedConfirmation}" to proceed.`);
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [wps] = await conn.query(`SELECT contact_id, user_id FROM workforce_profiles WHERE id = ?`, [id]);
        const contactId = wps[0]?.contact_id;
        const targetUserId = wps[0]?.user_id;

        await conn.query(`DELETE FROM workforce_profiles WHERE id = ?`, [id]);

        if (targetUserId) {
          await conn.query(`DELETE FROM user_roles WHERE user_id = ?`, [targetUserId]);
          await conn.query(`DELETE FROM refresh_tokens WHERE user_id = ?`, [targetUserId]);
          await conn.query(`DELETE FROM users WHERE id = ?`, [targetUserId]);
        }

        await conn.commit();

        await logAuthEvent(user.id, "WORKFORCE_PERMANENTLY_DELETED", ip, userAgent, {
          workforceId: id,
          workforceCode: safety.workforce_code,
          contactId,
          targetUserId
        });

        return {
          success: true,
          id,
          action: "PERMANENT_DELETE",
          message: `Member ${safety.workforce_code} has been permanently deleted from the database.`
        };
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    throw new ApiError(400, "Invalid action specified. Must be 'ARCHIVE' or 'PERMANENT_DELETE'.");
  }

  /**
   * Request password reset for employee
   */
  static async resetPasswordForEmployee(id, user, ip = null, userAgent = null) {
    const [profiles] = await pool.query(
      `SELECT wp.workforce_code, u.id as user_id, u.email, c.first_name, c.last_name
       FROM workforce_profiles wp
       JOIN contacts c ON wp.contact_id = c.id
       LEFT JOIN users u ON wp.user_id = u.id
       WHERE wp.id = ?`,
      [id]
    );
    if (profiles.length === 0) {
      throw new ApiError(404, "Workforce member not found.");
    }
    const profile = profiles[0];
    if (!profile.user_id || !profile.email) {
      throw new ApiError(400, "This workforce member does not have an active user account. Please activate the member first.");
    }

    const resetToken = await emailSecurityService.createPasswordResetToken(profile.user_id, ip, userAgent);
    const resetUrl = `${env.email.appUrl}/reset-password?token=${resetToken}`;

    try {
      await centralEmailService.sendEmail({
        to: profile.email,
        subject: "Reset Your Chambers Account Password",
        html: `<p>Hello ${profile.first_name},</p><p>You recently requested a password reset for your Chambers account. Please click the link below to set a new password:</p><p><a href="${resetUrl}" style="padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:4px;">Reset Password</a></p><p>This link is valid for 30 minutes and can only be used once.</p>`,
        metadata: {
          userId: profile.user_id,
          category: "SECURITY"
        }
      });
    } catch (emailErr) {
      console.warn("[Password Reset Email Warning]:", emailErr.message);
    }

    await logAuthEvent(user.id, "PASSWORD_RESET_REQUESTED", ip, userAgent, {
      targetUserId: profile.user_id,
      workforceId: id,
      email: profile.email
    });

    return {
      success: true,
      message: `Password reset email sent to ${profile.email}.`,
      email: profile.email,
      resetToken
    };
  }

  /**
   * Resend onboarding / setup invitation
   */
  static async resendInvitation(id, user, ip = null, userAgent = null) {
    const [profiles] = await pool.query(
      `SELECT wp.workforce_code, u.id as user_id, u.email, c.first_name, c.last_name, c.email as contact_email
       FROM workforce_profiles wp
       JOIN contacts c ON wp.contact_id = c.id
       LEFT JOIN users u ON wp.user_id = u.id
       WHERE wp.id = ?`,
      [id]
    );
    if (profiles.length === 0) {
      throw new ApiError(404, "Workforce member not found.");
    }
    const profile = profiles[0];
    const targetEmail = profile.email || profile.contact_email;

    if (!targetEmail) {
      throw new ApiError(400, "No email address found for this workforce member.");
    }

    let userId = profile.user_id;
    if (!userId) {
      const [existingUsers] = await pool.query(`SELECT id FROM users WHERE email = ?`, [targetEmail]);
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
      } else {
        const tempPassword = `${crypto.randomBytes(16).toString("hex")}!Aa1`;
        const hash = await bcrypt.hash(tempPassword, 12);
        const [newUser] = await pool.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, status) VALUES (?, ?, ?, ?, 'INVITED')`,
          [profile.first_name || "Member", profile.last_name || "", targetEmail, hash]
        );
        userId = newUser.insertId;
        const [roleRows] = await pool.query(`SELECT id FROM roles WHERE name = 'JUNIOR_ASSOCIATE'`);
        if (roleRows.length > 0) {
          await pool.query(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, roleRows[0].id]);
        }
      }
      await pool.query(`UPDATE workforce_profiles SET user_id = ? WHERE id = ?`, [userId, id]);
    }

    await pool.query(`DELETE FROM user_invitations WHERE user_id = ?`, [userId]);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO user_invitations (user_id, token_hash, expires_at, created_by) VALUES (?, ?, ?, ?)`,
      [userId, tokenHash, expiresAt, user.id]
    );

    const inviteUrl = `${env.email.appUrl}/setup?token=${rawToken}`;
    try {
      await centralEmailService.sendEmail({
        to: targetEmail,
        subject: "Invitation to Join Legal Practice Platform",
        html: `<p>Hello ${profile.first_name},</p><p>You have been invited to join the chambers platform. Please click the link below to complete your account setup:</p><p><a href="${inviteUrl}" style="padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:4px;">Complete Setup</a></p>`,
        metadata: {
          userId,
          category: "SYSTEM"
        }
      });
    } catch (emailErr) {
      console.warn("[Invitation Email Warning]:", emailErr.message);
    }

    await logAuthEvent(user.id, "WORKFORCE_INVITATION_RESENT", ip, userAgent, {
      workforceId: id,
      targetUserId: userId,
      email: targetEmail
    });

    return {
      success: true,
      message: `Invitation email sent successfully to ${targetEmail}.`,
      email: targetEmail,
      inviteToken: rawToken
    };
  }

  /**
   * Fetch cases assigned to this workforce member
   */
  static async getAssignedCases(id) {
    const [profiles] = await pool.query(`SELECT user_id FROM workforce_profiles WHERE id = ?`, [id]);
    if (profiles.length === 0) throw new ApiError(404, "Member not found.");
    const userId = profiles[0].user_id;
    if (!userId) return [];

    const [cases] = await pool.query(
      `SELECT c.id, c.id AS case_id, c.case_number, c.title, c.title AS case_title, c.case_type, 
              c.case_status AS status, c.filing_date, ca.role_in_case AS assignment_role, ca.role_in_case AS role, ca.created_at AS assigned_at
       FROM case_assignments ca
       JOIN cases c ON ca.case_id = c.id
       WHERE ca.user_id = ? AND c.deleted_at IS NULL
       ORDER BY ca.created_at DESC`,
      [userId]
    );
    return cases;
  }

  /**
   * Fetch attendance logs for this member
   */
  static async getMemberAttendance(id, query = {}) {
    const page = query.page || 1;
    const limit = query.limit || 15;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [logs] = await pool.query(
      `SELECT id, attendance_date, attendance_date AS date, check_in AS check_in_time, check_out AS check_out_time, 
              status, total_hours, remarks, remarks AS notes
       FROM workforce_attendance
       WHERE workforce_id = ?
       ORDER BY attendance_date DESC
       LIMIT ? OFFSET ?`,
      [id, parseInt(limit, 10), offset]
    );
    const [count] = await pool.query(
      `SELECT COUNT(*) as total FROM workforce_attendance WHERE workforce_id = ?`,
      [id]
    );
    return { logs, total: count[0].total, page: parseInt(page, 10), limit: parseInt(limit, 10) };
  }

  /**
   * Fetch leave balances and requests
   */
  static async getMemberLeaves(id) {
    const [balances] = await pool.query(
      `SELECT wlb.*, wlt.name as leave_type_name, wlt.code as leave_type_code
       FROM workforce_leave_balances wlb
       JOIN workforce_leave_types wlt ON wlb.leave_type_id = wlt.id
       WHERE wlb.workforce_id = ? AND wlb.year = YEAR(CURDATE())`,
      [id]
    );
    const [requests] = await pool.query(
      `SELECT wlr.*, wlt.name as leave_type_name
       FROM workforce_leave_requests wlr
       JOIN workforce_leave_types wlt ON wlr.leave_type_id = wlt.id
       WHERE wlr.workforce_id = ?
       ORDER BY wlr.created_at DESC
       LIMIT 15`,
      [id]
    );
    return { balances, requests };
  }

  /**
   * Fetch internal tasks assigned to member
   */
  static async getMemberTasks(id) {
    const [profiles] = await pool.query(`SELECT user_id FROM workforce_profiles WHERE id = ?`, [id]);
    const userId = profiles[0]?.user_id || 0;

    const [tasks] = await pool.query(
      `SELECT id, task_code, title, description, task_type, priority, status, due_date, created_at
       FROM workforce_tasks
       WHERE assigned_to = ?
       ORDER BY created_at DESC
       LIMIT 25`,
      [userId]
    );
    return { tasks };
  }

  /**
   * Fetch documents created or authored by member
   */
  static async getMemberDocuments(id) {
    const [profiles] = await pool.query(`SELECT user_id FROM workforce_profiles WHERE id = ?`, [id]);
    if (profiles.length === 0) throw new ApiError(404, "Member not found.");
    const userId = profiles[0].user_id;
    if (!userId) return [];

    const [docs] = await pool.query(
      `SELECT d.id, d.title, 
              COALESCE(d.internal_file_name, d.external_file_name, d.title) as file_name,
              COALESCE(d.internal_mime_type, d.external_mime_type, 'application/octet-stream') as mime_type,
              COALESCE(d.internal_file_size, d.external_file_size, 0) as file_size_bytes,
              d.status, d.created_at
       FROM documents d
       WHERE (d.workforce_id = ? OR (d.created_by = ? AND ? > 0)) AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC
       LIMIT 25`,
      [id, userId || 0, userId || 0]
    );
    return docs;
  }

  /**
   * Fetch audit history for this workforce member
   */
  static async getMemberAuditHistory(id) {
    const [profiles] = await pool.query(`SELECT user_id, workforce_code FROM workforce_profiles WHERE id = ?`, [id]);
    if (profiles.length === 0) throw new ApiError(404, "Member not found.");
    const userId = profiles[0].user_id;
    const code = profiles[0].workforce_code;

    const [logs] = await pool.query(
      `SELECT al.id, al.user_id, al.action, al.ip_address, al.user_agent, al.details, al.created_at,
              u.first_name AS actor_first_name, u.last_name AS actor_last_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE (al.entity_id = ? AND al.action LIKE 'WORKFORCE%')
          OR (al.entity_id = ? AND al.action LIKE 'PASSWORD%')
          OR (al.user_id = ? AND al.user_id IS NOT NULL)
          OR al.details LIKE ? OR al.details LIKE ?
       ORDER BY al.created_at DESC
       LIMIT 40`,
      [id, userId || -1, userId || -1, `%"workforceId":${id}%`, `%"workforceCode":"${code}"%`]
    );
    return {
      logs: logs.map(l => ({
        ...l,
        actor_name: l.actor_first_name ? `${l.actor_first_name} ${l.actor_last_name || ""}`.trim() : `User #${l.user_id}`,
        details: typeof l.details === "string" ? (() => { try { return JSON.parse(l.details); } catch(e) { return l.details; } })() : l.details
      }))
    };
  }

  /**
   * Helper: Calculate active dependencies for a workforce member
   */
  static async getMemberDependencies(id, userId, conn = pool) {
    let assignedCases = 0;
    let pendingTasks = 0;
    if (userId) {
      const [cases] = await conn.query(`SELECT COUNT(*) as cnt FROM case_assignments WHERE user_id = ?`, [userId]);
      assignedCases = cases[0].cnt;

      const [tasks] = await conn.query(
        `SELECT COUNT(*) as cnt FROM workforce_tasks WHERE assigned_to = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`,
        [userId]
      );
      pendingTasks = tasks[0].cnt;
    }
    return { assignedCases, pendingTasks };
  }

  /**
   * State Machine: Change status
   */
  static async updateStatus(id, newStatus, reason = "", user = {}) {
    const [profiles] = await pool.query(
      `SELECT * FROM workforce_profiles WHERE id = ?`,
      [id]
    );
    if (profiles.length === 0) {
      throw new ApiError(404, "Workforce member not found.");
    }
    const profile = profiles[0];

    // Activation Guard
    if (newStatus === "ACTIVE" && profile.status === "ONBOARDING") {
      const [pendingMandatory] = await pool.query(
        `SELECT COUNT(*) AS pending 
         FROM workforce_onboarding_checklists 
         WHERE workforce_id = ? AND mandatory = TRUE AND status NOT IN ('COMPLETED', 'WAIVED')`,
        [id]
      );

      const isOwner = user.role === "OWNER" || (user.roles && user.roles.includes("OWNER"));
      if (pendingMandatory[0].pending > 0 && !isOwner) {
        throw new ApiError(
          400,
          `Cannot activate profile: ${pendingMandatory[0].pending} mandatory onboarding checklist item(s) are still incomplete. Only OWNER can override.`
        );
      }
    }

    await pool.query(
      `UPDATE workforce_profiles SET status = ?, notes = CONCAT(COALESCE(notes, ''), '\n[Status Change]: ', ?, ' by User #', ?) WHERE id = ?`,
      [newStatus, `${newStatus} (${reason})`, user.id || 0, id]
    );

    // If intern, sync internship_status
    if (profile.workforce_type.includes("INTERN")) {
      await pool.query(
        `UPDATE internship_records SET internship_status = ? WHERE workforce_id = ?`,
        [newStatus, id]
      );
    }

    return { id, status: newStatus };
  }

  /**
   * Dashboard statistics for workforce management
   */
  static async getDashboardStats() {
    const [counts] = await pool.query(`
      SELECT
        COUNT(*) AS total_workforce,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_members,
        SUM(CASE WHEN workforce_type = 'EMPLOYEE' AND status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_employees,
        SUM(CASE WHEN workforce_type = 'PAID_INTERN' AND status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_paid_interns,
        SUM(CASE WHEN workforce_type = 'UNPAID_INTERN' AND status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_unpaid_interns,
        SUM(CASE WHEN workforce_type = 'CONTRACTOR' AND status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_contractors,
        SUM(CASE WHEN status = 'ONBOARDING' THEN 1 ELSE 0 END) AS onboarding_count,
        SUM(CASE WHEN status = 'ON_NOTICE' THEN 1 ELSE 0 END) AS on_notice_count
      FROM workforce_profiles
    `);

    // Today's attendance stats
    const today = new Date().toISOString().slice(0, 10);
    const [attStats] = await pool.query(
      `SELECT
        COUNT(*) AS total_punches,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) AS present_count,
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN status = 'WORK_FROM_HOME' THEN 1 ELSE 0 END) AS wfh_count,
        SUM(CASE WHEN status = 'LEAVE' THEN 1 ELSE 0 END) AS leave_count
       FROM workforce_attendance
       WHERE attendance_date = ?`,
      [today]
    );

    // Pending leave requests
    const [leaveStats] = await pool.query(
      `SELECT COUNT(*) AS pending_leaves FROM workforce_leave_requests WHERE status = 'PENDING'`
    );

    // Active candidate pipeline count
    const [candStats] = await pool.query(
      `SELECT COUNT(*) AS active_candidates FROM candidate_pipeline WHERE stage NOT IN ('REJECTED', 'WITHDRAWN', 'ACTIVE')`
    );

    // Open internal tasks
    const [taskStats] = await pool.query(
      `SELECT COUNT(*) AS open_tasks FROM workforce_tasks WHERE status NOT IN ('COMPLETED', 'CANCELLED')`
    );

    return {
      workforce: counts[0],
      attendance_today: attStats[0],
      pending_leaves: leaveStats[0].pending_leaves,
      active_candidates: candStats[0].active_candidates,
      open_tasks: taskStats[0].open_tasks,
    };
  }
}

module.exports = WorkforceService;
