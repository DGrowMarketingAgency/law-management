const db = require('../config/database');

class DocumentSearchService {
  /**
   * Comprehensive search with strict authorization filters
   */
  async searchDocuments(params = {}, user) {
    const {
      query = '',
      caseId = null,
      clientId = null,
      documentTypeId = null,
      folderId = null,
      status = null,
      confidentiality = null,
      createdBy = null,
      startDate = null,
      endDate = null,
      tag = null,
      limit = 50,
      offset = 0
    } = params;

    const roles = user.roles || [user.role];
    const isOwnerOrAdmin = roles.includes('OWNER') || roles.includes('ADMIN');
    const isSenior = roles.includes('SENIOR_ASSOCIATE');
    const isJunior = roles.includes('JUNIOR_ASSOCIATE');
    const isIntern = roles.includes('INTERN');
    const isClient = roles.includes('CLIENT');

    let sql = `
      SELECT DISTINCT d.*, 
        c.case_number, c.title as case_title, c.cnr_number,
        cl.display_name as client_name,
        dt.name as document_type_name, dt.code as document_type_code,
        df.name as folder_name,
        dv.version_number, dv.original_filename, dv.file_size, dv.mime_type, dv.checksum,
        u.first_name as creator_first_name, u.last_name as creator_last_name,
        sr.status as signature_status, sr.request_code as signature_request_code
      FROM documents d
      LEFT JOIN cases c ON d.case_id = c.id
      LEFT JOIN clients cl ON d.client_id = cl.id
      LEFT JOIN document_types dt ON d.document_type_id = dt.id
      LEFT JOIN document_folders df ON d.folder_id = df.id
      LEFT JOIN document_versions dv ON d.current_version_id = dv.id
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN document_signature_requests sr ON sr.document_id = d.id AND sr.status IN ('REQUESTED', 'SENT', 'SIGNED')
      WHERE d.deleted_at IS NULL
    `;
    const sqlParams = [];

    // --- Strict Authorization Filtering ---
    if (isClient) {
      // Clients can only discover documents explicitly shared with them
      sql += ` AND d.id IN (
        SELECT ds.document_id FROM document_shares ds
        WHERE (ds.shared_with_user_id = ? OR ds.shared_with_client_id = (SELECT id FROM clients WHERE contact_id = ? LIMIT 1))
          AND ds.revoked_at IS NULL
          AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
      )`;
      sqlParams.push(user.id, user.contact_id || -1);

      // Block advocate-only and internal drafts from client search
      sql += ` AND d.confidentiality_level != 'ADVOCATE_ONLY' AND d.status != 'DRAFT'`;
    } else if (isJunior || isIntern) {
      // Junior/Intern only see cases they are assigned to, or firm-level public documents
      sql += ` AND (
        d.case_id IS NULL OR d.case_id IN (
          SELECT ca.case_id FROM case_assignments ca WHERE ca.user_id = ?
        )
      )`;
      sqlParams.push(user.id);

      // Bar from ADVOCATE_ONLY documents
      sql += ` AND d.confidentiality_level != 'ADVOCATE_ONLY'`;
    }

    // --- Search Query Filter ---
    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      sql += ` AND (
        d.title LIKE ? OR 
        d.description LIKE ? OR 
        d.document_number LIKE ? OR
        c.case_number LIKE ? OR
        c.cnr_number LIKE ? OR
        cl.display_name LIKE ? OR
        dt.name LIKE ? OR
        d.id IN (
          SELECT dtc.document_id FROM document_text_content dtc 
          WHERE MATCH(dtc.extracted_text) AGAINST(? IN BOOLEAN MODE)
        )
      )`;
      sqlParams.push(q, q, q, q, q, q, q, query.trim());
    }

    // --- Metadata Filters ---
    if (caseId) {
      sql += ` AND d.case_id = ?`;
      sqlParams.push(caseId);
    }
    if (clientId) {
      sql += ` AND d.client_id = ?`;
      sqlParams.push(clientId);
    }
    if (documentTypeId) {
      sql += ` AND d.document_type_id = ?`;
      sqlParams.push(documentTypeId);
    }
    if (folderId) {
      sql += ` AND d.folder_id = ?`;
      sqlParams.push(folderId);
    }
    if (status) {
      sql += ` AND d.status = ?`;
      sqlParams.push(status);
    }
    if (confidentiality) {
      sql += ` AND d.confidentiality_level = ?`;
      sqlParams.push(confidentiality);
    }
    if (createdBy) {
      sql += ` AND d.created_by = ?`;
      sqlParams.push(createdBy);
    }
    if (startDate) {
      sql += ` AND d.created_at >= ?`;
      sqlParams.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      sql += ` AND d.created_at <= ?`;
      sqlParams.push(`${endDate} 23:59:59`);
    }
    if (tag) {
      sql += ` AND d.id IN (
        SELECT dtm.document_id FROM document_tag_map dtm
        JOIN document_tags dt ON dtm.tag_id = dt.id
        WHERE dt.name = ?
      )`;
      sqlParams.push(tag);
    }

    sql += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
    sqlParams.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows] = await db.query(sql, sqlParams);
    return rows;
  }
}

module.exports = new DocumentSearchService();
