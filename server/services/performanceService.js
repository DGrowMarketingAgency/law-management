const pool = require("../config/database");
const { ApiError } = require("../middleware/errorHandler");

/**
 * PerformanceService
 * Manages Chambers OKRs/goals, formal appraisals,
 * intern legal evaluation metrics (1-5), and controlled disciplinary warnings.
 */
class PerformanceService {
  /**
   * List goals for a workforce member
   */
  static async getGoals(workforceId) {
    const [rows] = await pool.query(
      `SELECT * FROM workforce_goals WHERE workforce_id = ? ORDER BY id DESC`,
      [workforceId]
    );
    return rows;
  }

  /**
   * Create goal
   */
  static async createGoal(workforceId, data) {
    const [res] = await pool.query(
      `INSERT INTO workforce_goals
       (workforce_id, goal_title, description, period, target, completion_percentage, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        workforceId,
        data.goal_title,
        data.description || null,
        data.period || "Q3-2026",
        data.target || null,
        data.completion_percentage || 0,
        data.status || "IN_PROGRESS",
      ]
    );
    return { id: res.insertId, status: data.status || "IN_PROGRESS" };
  }

  /**
   * Update goal progress
   */
  static async updateGoal(id, data) {
    await pool.query(
      `UPDATE workforce_goals
       SET completion_percentage = COALESCE(?, completion_percentage),
           status = COALESCE(?, status),
           remarks = COALESCE(?, remarks)
       WHERE id = ?`,
      [
        data.completion_percentage !== undefined ? data.completion_percentage : null,
        data.status || null,
        data.remarks || null,
        id,
      ]
    );
    return { id, status: "UPDATED" };
  }

  /**
   * List reviews for workforce member
   */
  static async getReviews(workforceId, requestingUser) {
    let sql = `
      SELECT 
        wpr.*,
        reviewer.first_name AS reviewer_first_name,
        reviewer.last_name AS reviewer_last_name
      FROM workforce_performance_reviews wpr
      JOIN users reviewer ON wpr.reviewer_user_id = reviewer.id
      WHERE wpr.workforce_id = ?
    `;

    // If the requesting user is the member himself, only show reviews where is_shareable_with_member = true
    if (["INTERN", "JUNIOR_ASSOCIATE"].includes(requestingUser.role)) {
      sql += ` AND wpr.is_shareable_with_member = TRUE`;
    }

    sql += ` ORDER BY wpr.id DESC`;

    const [rows] = await pool.query(sql, [workforceId]);
    return rows;
  }

  /**
   * Submit performance review
   */
  static async createReview(workforceId, data, reviewerUserId) {
    const [profiles] = await pool.query(
      `SELECT * FROM workforce_profiles WHERE id = ?`,
      [workforceId]
    );
    if (profiles.length === 0) {
      throw new ApiError(404, "Workforce profile not found.");
    }

    const [res] = await pool.query(
      `INSERT INTO workforce_performance_reviews
       (workforce_id, reviewer_user_id, review_period, overall_rating, 
        research_quality, drafting_quality, punctuality, legal_learning, professionalism, 
        strengths, improvements, mentor_comments, is_shareable_with_member, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workforceId,
        reviewerUserId,
        data.review_period || "Monthly Evaluation",
        parseInt(data.overall_rating, 10) || 4,
        data.research_quality ? parseInt(data.research_quality, 10) : null,
        data.drafting_quality ? parseInt(data.drafting_quality, 10) : null,
        data.punctuality ? parseInt(data.punctuality, 10) : null,
        data.legal_learning ? parseInt(data.legal_learning, 10) : null,
        data.professionalism ? parseInt(data.professionalism, 10) : null,
        data.strengths || null,
        data.improvements || null,
        data.mentor_comments || null,
        data.is_shareable_with_member !== undefined ? data.is_shareable_with_member : true,
        data.status || "SUBMITTED",
      ]
    );

    return { id: res.insertId, status: data.status || "SUBMITTED" };
  }

  /**
   * List disciplinary warnings
   */
  static async getWarnings(workforceId, requestingUser) {
    const [rows] = await pool.query(
      `SELECT 
        wfw.*,
        issuer.first_name AS issuer_first_name,
        issuer.last_name AS issuer_last_name
       FROM workforce_warnings wfw
       JOIN users issuer ON wfw.issued_by = issuer.id
       WHERE wfw.workforce_id = ?
       ORDER BY wfw.id DESC`,
      [workforceId]
    );
    return rows;
  }

  /**
   * Issue disciplinary warning
   */
  static async issueWarning(workforceId, data, currentUserId) {
    const [res] = await pool.query(
      `INSERT INTO workforce_warnings
       (workforce_id, issued_by, issue_date, category, description, severity, response_due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ISSUED')`,
      [
        workforceId,
        currentUserId,
        data.issue_date || new Date().toISOString().slice(0, 10),
        data.category || "PERFORMANCE",
        data.description,
        data.severity || "MEDIUM",
        data.response_due_date || null,
      ]
    );

    return { id: res.insertId, status: "ISSUED" };
  }

  /**
   * Respond to warning or resolve warning
   */
  static async updateWarning(id, data, user) {
    const [rows] = await pool.query(
      `SELECT * FROM workforce_warnings WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) {
      throw new ApiError(404, "Warning record not found.");
    }

    if (data.member_response !== undefined) {
      await pool.query(
        `UPDATE workforce_warnings
         SET member_response = ?, status = 'RESPONSE_SUBMITTED'
         WHERE id = ?`,
        [data.member_response, id]
      );
    }

    if (data.resolution !== undefined || data.status !== undefined) {
      await pool.query(
        `UPDATE workforce_warnings
         SET resolution = COALESCE(?, resolution), status = COALESCE(?, status)
         WHERE id = ?`,
        [data.resolution || null, data.status || null, id]
      );
    }

    return { id, status: "UPDATED" };
  }
}

module.exports = PerformanceService;
