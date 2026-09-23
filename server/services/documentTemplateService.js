const db = require('../config/database');
const { generateLegalDocumentPdf } = require('../utils/legalPdfGenerator');

class DocumentTemplateService {
  /**
   * Get all templates with filters
   */
  async getTemplates({ status = 'ACTIVE', caseType = null, documentTypeId = null } = {}) {
    let sql = `
      SELECT t.*, dt.name as document_type_name, dt.code as document_type_code,
             u.first_name as creator_first_name, u.last_name as creator_last_name
      FROM document_templates t
      LEFT JOIN document_types dt ON t.document_type_id = dt.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status);
    }
    if (caseType) {
      sql += ` AND (t.case_type = ? OR t.case_type IS NULL)`;
      params.push(caseType);
    }
    if (documentTypeId) {
      sql += ` AND t.document_type_id = ?`;
      params.push(documentTypeId);
    }

    sql += ` ORDER BY t.name ASC`;
    const [rows] = await db.query(sql, params);
    return rows;
  }

  /**
   * Get single template by ID
   */
  async getTemplateById(templateId) {
    const [rows] = await db.query(
      `SELECT t.*, dt.name as document_type_name, dt.code as document_type_code
       FROM document_templates t
       LEFT JOIN document_types dt ON t.document_type_id = dt.id
       WHERE t.id = ?`,
      [templateId]
    );

    if (rows.length === 0) {
      const err = new Error('Template not found.');
      err.statusCode = 404;
      throw err;
    }

    const tpl = rows[0];
    if (typeof tpl.variables === 'string') {
      try {
        tpl.variables = JSON.parse(tpl.variables);
      } catch (e) {
        tpl.variables = [];
      }
    }
    return tpl;
  }

  /**
   * Extract variable names matching {{VAR_NAME}}
   */
  extractVariables(content) {
    if (!content) return [];
    return Array.from(content.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)).map(m => m[1]);
  }

  /**
   * Create template
   */
  async createTemplate({ templateCode, name, description, documentTypeId, caseType, content, variables = [] }, userId) {
    if (!name || !content) {
      const err = new Error('Template name and content are required.');
      err.statusCode = 400;
      throw err;
    }

    // Auto-extract {{VARIABLES}} from content if not explicitly provided
    const extracted = this.extractVariables(content);
    const finalVars = Array.from(new Set([...variables, ...extracted]));

    const code = templateCode || `TPL-${Date.now().toString().slice(-6)}`;

    const [res] = await db.query(
      `INSERT INTO document_templates (
        template_code, name, description, document_type_id, case_type, content, variables, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [
        code,
        name.trim(),
        description ? description.trim() : null,
        documentTypeId || null,
        caseType || null,
        content,
        JSON.stringify(finalVars),
        userId
      ]
    );

    return { id: res.insertId, template_code: code, name };
  }

  /**
   * Update template
   */
  async updateTemplate(templateId, { name, description, documentTypeId, caseType, content, variables, status }, userId) {
    const existing = await this.getTemplateById(templateId);

    let finalVars = variables;
    if (content) {
      const extracted = Array.from(content.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)).map(m => m[1]);
      finalVars = Array.from(new Set([...(variables || existing.variables || []), ...extracted]));
    }

    await db.query(
      `UPDATE document_templates SET
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         document_type_id = COALESCE(?, document_type_id),
         case_type = COALESCE(?, case_type),
         content = COALESCE(?, content),
         variables = COALESCE(?, variables),
         status = COALESCE(?, status),
         updated_by = ?
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        description !== undefined ? description : null,
        documentTypeId || null,
        caseType !== undefined ? caseType : null,
        content || null,
        finalVars ? JSON.stringify(finalVars) : null,
        status || null,
        userId,
        templateId
      ]
    );

    return { id: templateId, success: true };
  }

  /**
   * Archive template (does not delete historically used templates)
   */
  async archiveTemplate(templateId) {
    await db.query(`UPDATE document_templates SET status = 'ARCHIVED' WHERE id = ?`, [templateId]);
    return { id: templateId, success: true };
  }

  /**
   * Validate and replace placeholders in template content
   * @param {string} content
   * @param {Object} variablesProvided
   * @returns {{ resolvedContent: string, missingVariables: string[] }}
   */
  resolveVariables(content, variablesProvided = {}) {
    const regex = /\{\{([A-Za-z0-9_]+)\}\}/g;
    const missing = [];

    const resolved = content.replace(regex, (match, varName) => {
      if (variablesProvided[varName] !== undefined && variablesProvided[varName] !== null) {
        return String(variablesProvided[varName]);
      }
      missing.push(varName);
      return match; // preserve un-replaced placeholder
    });

    return {
      resolvedContent: resolved,
      missingVariables: missing
    };
  }

  /**
   * Pre-populates contextual placeholders from Case & Client records
   */
  async getContextVariables(caseId, clientId = null, userId = null) {
    const context = {
      DATE: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    };

    if (caseId) {
      const [caseRows] = await db.query(
        `SELECT c.*, cl.display_name as client_name, cl.email as client_email, cl.phone as client_phone,
                co.name as court_name
         FROM cases c
         LEFT JOIN clients cl ON c.primary_client_id = cl.id
         LEFT JOIN courts co ON c.court_id = co.id
         WHERE c.id = ?`,
        [caseId]
      );

      if (caseRows.length > 0) {
        const c = caseRows[0];
        context.CASE_TITLE = c.title || '';
        context.CASE_NUMBER = c.case_number || '';
        context.CNR_NUMBER = c.cnr_number || '';
        context.COURT_NAME = c.court_name || '';
        context.CLIENT_NAME = c.client_name || '';
        context.OPPOSING_PARTY = c.opposing_party || '';
      }
    }

    if (clientId && !context.CLIENT_NAME) {
      const [clientRows] = await db.query(`SELECT display_name, email, phone, address FROM clients WHERE id = ?`, [clientId]);
      if (clientRows.length > 0) {
        context.CLIENT_NAME = clientRows[0].display_name;
        context.CLIENT_ADDRESS = clientRows[0].address || '';
      }
    }

    if (userId) {
      const [userRows] = await db.query(`SELECT first_name, last_name, email FROM users WHERE id = ?`, [userId]);
      if (userRows.length > 0) {
        context.ADVOCATE_NAME = `${userRows[0].first_name} ${userRows[0].last_name}`.trim();
      }
    }

    return context;
  }

  /**
   * Renders resolved text into a clean printable PDF buffer
   */
  async generatePdfFromText(title, textContent) {
    return generateLegalDocumentPdf({
      title: title || 'LEGAL DOCUMENT',
      content: textContent || ''
    });
  }
}

module.exports = new DocumentTemplateService();
