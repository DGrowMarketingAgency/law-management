const pool = require("../config/database");
const WorkforceCodeService = require("./workforceCodeService");
const WorkforceService = require("./workforceService");
const { ApiError } = require("../middleware/errorHandler");

/**
 * CandidateService
 * Recruitment, ATS pipeline, interview rounds, and offer letter management.
 */
class CandidateService {
  /**
   * List candidates with filters
   */
  static async getCandidates(filters = {}) {
    const { stage, applying_for, search, page = 1, limit = 20 } = filters;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let whereClause = "WHERE 1=1";

    if (stage) {
      whereClause += " AND cp.stage = ?";
      params.push(stage);
    }

    if (applying_for) {
      whereClause += " AND cp.applying_for = ?";
      params.push(applying_for);
    }

    if (search) {
      whereClause += ` AND (
        cp.candidate_code LIKE ? OR 
        cp.full_name LIKE ? OR 
        cp.email LIKE ? OR 
        cp.phone LIKE ? OR 
        cp.college_institution LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM candidate_pipeline cp ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT 
        cp.*,
        (SELECT COUNT(*) FROM interview_records ir WHERE ir.candidate_id = cp.id) AS interview_count,
        (SELECT AVG(rating) FROM interview_records ir WHERE ir.candidate_id = cp.id AND ir.rating IS NOT NULL) AS avg_rating,
        (SELECT wo.offer_code FROM workforce_offers wo WHERE wo.candidate_id = cp.id ORDER BY wo.id DESC LIMIT 1) AS latest_offer_code,
        (SELECT wo.status FROM workforce_offers wo WHERE wo.candidate_id = cp.id ORDER BY wo.id DESC LIMIT 1) AS latest_offer_status
       FROM candidate_pipeline cp
       ${whereClause}
       ORDER BY cp.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return {
      candidates: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    };
  }

  /**
   * Get candidate details including interview rounds and offers
   */
  static async getCandidateById(id) {
    const [rows] = await pool.query(
      `SELECT * FROM candidate_pipeline WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) {
      throw new ApiError(404, "Candidate not found.");
    }
    const candidate = rows[0];

    const [interviews] = await pool.query(
      `SELECT ir.*, 
              u.email AS interviewer_email,
              u.first_name AS interviewer_first_name,
              u.last_name AS interviewer_last_name
       FROM interview_records ir
       JOIN users u ON ir.interviewer_user_id = u.id
       WHERE ir.candidate_id = ?
       ORDER BY ir.round_number ASC`,
      [id]
    );

    const [offers] = await pool.query(
      `SELECT * FROM workforce_offers WHERE candidate_id = ? ORDER BY id DESC`,
      [id]
    );

    return {
      candidate,
      interviews,
      offers,
    };
  }

  /**
   * Register new candidate
   */
  static async createCandidate(data) {
    const candidateCode = await WorkforceCodeService.generateCode(
      "CAN",
      "candidate_pipeline",
      "candidate_code"
    );

    const [res] = await pool.query(
      `INSERT INTO candidate_pipeline
       (candidate_code, full_name, email, phone, applying_for, college_institution, 
        course_degree, graduation_year, resume_url, source, applied_date, 
        expected_start_date, expected_duration_weeks, stipend_salary_expectation, remarks, stage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPLIED')`,
      [
        candidateCode,
        data.full_name,
        data.email,
        data.phone,
        data.applying_for || "PAID_INTERN",
        data.college_institution || null,
        data.course_degree || null,
        data.graduation_year || null,
        data.resume_url || null,
        data.source || "DIRECT",
        data.applied_date || new Date().toISOString().slice(0, 10),
        data.expected_start_date || null,
        data.expected_duration_weeks || null,
        data.stipend_salary_expectation || null,
        data.remarks || null,
      ]
    );

    return { id: res.insertId, candidate_code: candidateCode };
  }

  /**
   * Advance or update candidate stage
   */
  static async updateStage(id, newStage, remarks = "") {
    const [candidates] = await pool.query(
      `SELECT * FROM candidate_pipeline WHERE id = ?`,
      [id]
    );
    if (candidates.length === 0) {
      throw new ApiError(404, "Candidate not found.");
    }

    await pool.query(
      `UPDATE candidate_pipeline 
       SET stage = ?, remarks = CONCAT(COALESCE(remarks, ''), '\n[Stage Update]: ', ?, ' - ', ?)
       WHERE id = ?`,
      [newStage, newStage, remarks, id]
    );

    return { id, stage: newStage };
  }

  /**
   * Schedule interview round
   */
  static async scheduleInterview(candidateId, data) {
    const [candidates] = await pool.query(
      `SELECT * FROM candidate_pipeline WHERE id = ?`,
      [candidateId]
    );
    if (candidates.length === 0) {
      throw new ApiError(404, "Candidate not found.");
    }

    // Determine round number
    const [roundRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM interview_records WHERE candidate_id = ?`,
      [candidateId]
    );
    const roundNumber = roundRows[0].count + 1;

    const [res] = await pool.query(
      `INSERT INTO interview_records
       (candidate_id, round_number, round_name, interviewer_user_id, scheduled_at, mode, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        candidateId,
        roundNumber,
        data.round_name || `Round ${roundNumber} - Legal Assessment`,
        data.interviewer_user_id,
        data.scheduled_at,
        data.mode || "IN_PERSON",
        data.notes || null,
      ]
    );

    // Auto advance candidate stage to INTERVIEW
    await pool.query(
      `UPDATE candidate_pipeline SET stage = 'INTERVIEW' WHERE id = ? AND stage IN ('APPLIED', 'SCREENING')`,
      [candidateId]
    );

    return { id: res.insertId, round_number: roundNumber };
  }

  /**
   * Submit interview feedback
   */
  static async recordInterviewFeedback(interviewId, data) {
    const [rows] = await pool.query(
      `SELECT * FROM interview_records WHERE id = ?`,
      [interviewId]
    );
    if (rows.length === 0) {
      throw new ApiError(404, "Interview record not found.");
    }

    await pool.query(
      `UPDATE interview_records
       SET rating = ?, notes = ?, recommendation = ?, result = ?
       WHERE id = ?`,
      [
        data.rating || null,
        data.notes || null,
        data.recommendation || null,
        data.result || "PENDING",
        interviewId,
      ]
    );

    // If result is SELECTED, advance candidate
    if (data.result === "SELECTED") {
      await pool.query(
        `UPDATE candidate_pipeline SET stage = 'SELECTED' WHERE id = ?`,
        [rows[0].candidate_id]
      );
    } else if (data.result === "REJECTED") {
      await pool.query(
        `UPDATE candidate_pipeline SET stage = 'REJECTED' WHERE id = ?`,
        [rows[0].candidate_id]
      );
    }

    return { id: interviewId, status: "UPDATED" };
  }

  /**
   * Issue offer letter
   */
  static async createOffer(candidateId, data, currentUserId) {
    const [candidates] = await pool.query(
      `SELECT * FROM candidate_pipeline WHERE id = ?`,
      [candidateId]
    );
    if (candidates.length === 0) {
      throw new ApiError(404, "Candidate not found.");
    }
    const candidate = candidates[0];

    const offerCode = await WorkforceCodeService.generateCode(
      "OFF",
      "workforce_offers",
      "offer_code"
    );

    const [res] = await pool.query(
      `INSERT INTO workforce_offers
       (candidate_id, offer_code, offer_type, designation, department, 
        joining_date, end_date, offered_compensation, terms, status, issued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', NOW())`,
      [
        candidateId,
        offerCode,
        candidate.applying_for,
        data.designation || (candidate.applying_for.includes("INTERN") ? "Legal Intern" : "Associate Counsel"),
        data.department || "Litigation & Dispute Resolution",
        data.joining_date,
        data.end_date || null,
        data.offered_compensation || 0.0,
        data.terms || "Standard Chambers engagement terms and confidentiality protocols apply.",
      ]
    );

    // Advance candidate to OFFERED
    await pool.query(
      `UPDATE candidate_pipeline SET stage = 'OFFERED' WHERE id = ?`,
      [candidateId]
    );

    return { id: res.insertId, offer_code: offerCode };
  }

  /**
   * Accept Offer and automatically transition candidate to onboarding workforce profile
   */
  static async acceptOffer(offerId, currentUserId) {
    const [offers] = await pool.query(
      `SELECT wo.*, cp.full_name, cp.email, cp.phone, cp.college_institution, cp.course_degree
       FROM workforce_offers wo
       JOIN candidate_pipeline cp ON wo.candidate_id = cp.id
       WHERE wo.id = ?`,
      [offerId]
    );
    if (offers.length === 0) {
      throw new ApiError(404, "Offer not found.");
    }
    const offer = offers[0];

    // Mark offer as accepted
    await pool.query(
      `UPDATE workforce_offers SET status = 'ACCEPTED', accepted_at = NOW() WHERE id = ?`,
      [offerId]
    );

    // Advance candidate to ACCEPTED
    await pool.query(
      `UPDATE candidate_pipeline SET stage = 'ACCEPTED' WHERE id = ?`,
      [offer.candidate_id]
    );

    // Auto-create workforce profile in ONBOARDING status
    const nameParts = (offer.full_name || "").trim().split(" ");
    const firstName = nameParts[0] || "Member";
    const lastName = nameParts.slice(1).join(" ") || "";

    const profileResult = await WorkforceService.createProfile(
      {
        first_name: firstName,
        last_name: lastName,
        email: offer.email,
        phone: offer.phone,
        workforce_type: offer.offer_type,
        designation: offer.designation,
        department: offer.department,
        joining_date: offer.joining_date,
        expected_end_date: offer.end_date,
        college_institution: offer.college_institution,
        course: offer.course_degree,
        stipend_amount: offer.offered_compensation,
      },
      currentUserId
    );

    // Link offer to workforce profile
    await pool.query(
      `UPDATE workforce_offers SET workforce_id = ? WHERE id = ?`,
      [profileResult.id, offerId]
    );

    // Update candidate to ONBOARDING
    await pool.query(
      `UPDATE candidate_pipeline SET stage = 'ONBOARDING' WHERE id = ?`,
      [offer.candidate_id]
    );

    return {
      offer_id: offerId,
      status: "ACCEPTED",
      workforce_id: profileResult.id,
      workforce_code: profileResult.workforce_code,
    };
  }
}

module.exports = CandidateService;
