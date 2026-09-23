const pool = require("../config/database");
const { ApiError } = require("../middleware/errorHandler");

/**
 * AssetService
 * Chambers asset issuance, condition tracking, and return workflows.
 */
class AssetService {
  static async getAssets(filters = {}) {
    const { workforce_id, status, search, page = 1, limit = 20 } = filters;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let whereClause = "WHERE 1=1";

    if (workforce_id) {
      whereClause += " AND wfa.workforce_id = ?";
      params.push(workforce_id);
    }

    if (status) {
      whereClause += " AND wfa.status = ?";
      params.push(status);
    }

    if (search) {
      whereClause += " AND (wfa.asset_name LIKE ? OR wfa.asset_code LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM workforce_asset_assignments wfa ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT 
        wfa.*,
        wp.workforce_code,
        wp.workforce_type,
        c.first_name,
        c.last_name
       FROM workforce_asset_assignments wfa
       JOIN workforce_profiles wp ON wfa.workforce_id = wp.id
       JOIN contacts c ON wp.contact_id = c.id
       ${whereClause}
       ORDER BY wfa.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return {
      assets: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    };
  }

  static async assignAsset(data, currentUserId) {
    const [res] = await pool.query(
      `INSERT INTO workforce_asset_assignments
       (workforce_id, asset_name, asset_code, issued_date, expected_return_date, condition_on_issue, status, remarks)
       VALUES (?, ?, ?, ?, ?, ?, 'ASSIGNED', ?)`,
      [
        data.workforce_id,
        data.asset_name,
        data.asset_code,
        data.issued_date || new Date().toISOString().slice(0, 10),
        data.expected_return_date || null,
        data.condition_on_issue || "Good / Working Condition",
        data.remarks || null,
      ]
    );

    return { id: res.insertId, status: "ASSIGNED" };
  }

  static async returnAsset(id, data, currentUserId) {
    const [rows] = await pool.query(
      `SELECT * FROM workforce_asset_assignments WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) {
      throw new ApiError(404, "Asset assignment record not found.");
    }

    await pool.query(
      `UPDATE workforce_asset_assignments
       SET returned_date = ?,
           condition_on_return = ?,
           status = ?,
           remarks = CONCAT(COALESCE(remarks, ''), '\n[Return Note]: ', ?)
       WHERE id = ?`,
      [
        data.returned_date || new Date().toISOString().slice(0, 10),
        data.condition_on_return || "Returned in Good Condition",
        data.status || "RETURNED",
        data.remarks || "",
        id,
      ]
    );

    return { id, status: data.status || "RETURNED" };
  }
}

module.exports = AssetService;
