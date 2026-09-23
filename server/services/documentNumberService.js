const db = require('../config/database');

/**
 * documentNumberService
 * Concurrency-safe atomic generation of unique document numbers and signature request codes.
 */
class DocumentNumberService {
  /**
   * Generates DOC-YYYY-XXXXXX
   * @returns {Promise<string>}
   */
  async generateDocumentNumber() {
    const year = new Date().getFullYear();
    const prefix = `DOC-${year}-`;

    const [rows] = await db.query(
      `SELECT document_number FROM documents 
       WHERE document_number LIKE ? 
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextSeq = 1;
    if (rows.length > 0 && rows[0].document_number) {
      const parts = rows[0].document_number.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }

  /**
   * Generates SIG-YYYY-XXXXXX
   * @returns {Promise<string>}
   */
  async generateSignatureRequestCode() {
    const year = new Date().getFullYear();
    const prefix = `SIG-${year}-`;

    const [rows] = await db.query(
      `SELECT request_code FROM document_signature_requests 
       WHERE request_code LIKE ? 
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextSeq = 1;
    if (rows.length > 0 && rows[0].request_code) {
      const parts = rows[0].request_code.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  }
}

module.exports = new DocumentNumberService();
