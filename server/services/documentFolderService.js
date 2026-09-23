const db = require('../config/database');

const DEFAULT_FOLDERS = [
  { name: '01_Pleadings', description: 'Plaints, Petitions, Written Statements & formal pleadings' },
  { name: '02_Applications', description: 'Interim applications, stay petitions, and miscellaneous applications' },
  { name: '03_Affidavits', description: 'Sworn statements and verification affidavits' },
  { name: '04_Evidence', description: 'Documentary evidence, exhibits, and depositions' },
  { name: '05_Court_Orders', description: 'Interim orders, daily order-sheets (Roznama), and judgments' },
  { name: '06_Correspondence', description: 'Formal counsel correspondence, notices, and client letters' },
  { name: '07_Vakalatnama', description: 'Advocate authorization forms and power of attorney' },
  { name: '08_Agreements', description: 'Contracts, settlement terms, and MOUs' },
  { name: '99_Other', description: 'Miscellaneous case records' }
];

class DocumentFolderService {
  /**
   * Initializes default case folders if not already present
   */
  async initDefaultCaseFolders(caseId, userId = 1) {
    if (!caseId) return;

    for (const folder of DEFAULT_FOLDERS) {
      await db.query(
        `INSERT IGNORE INTO document_folders (case_id, name, description, is_system, created_by)
         VALUES (?, ?, ?, TRUE, ?)`,
        [caseId, folder.name, folder.description, userId]
      );
    }
  }

  /**
   * Get all folders for a case (auto-initializes defaults if empty)
   */
  async getCaseFolders(caseId, userId = 1) {
    let [folders] = await db.query(
      `SELECT f.*, 
        (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id AND d.deleted_at IS NULL) as document_count
       FROM document_folders f
       WHERE f.case_id = ? AND f.archived_at IS NULL
       ORDER BY f.name ASC`,
      [caseId]
    );

    if (folders.length === 0) {
      await this.initDefaultCaseFolders(caseId, userId);
      [folders] = await db.query(
        `SELECT f.*, 0 as document_count
         FROM document_folders f
         WHERE f.case_id = ? AND f.archived_at IS NULL
         ORDER BY f.name ASC`,
        [caseId]
      );
    }

    return folders;
  }

  /**
   * Get folders by query (case-specific or firm-level)
   */
  async getFolders({ caseId = null, userId = 1 }) {
    if (caseId) {
      return this.getCaseFolders(caseId, userId);
    }
    const [folders] = await db.query(
      `SELECT f.*, 
        (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id AND d.deleted_at IS NULL) as document_count
       FROM document_folders f
       WHERE f.case_id IS NULL AND f.archived_at IS NULL
       ORDER BY f.name ASC`
    );
    return folders;
  }

  /**
   * Create custom folder
   */
  async createFolder({ caseId = null, parentFolderId = null, name, description = '', userId }) {
    if (!name || !name.trim()) {
      const err = new Error('Folder name is required.');
      err.statusCode = 400;
      throw err;
    }

    const [res] = await db.query(
      `INSERT INTO document_folders (case_id, parent_folder_id, name, description, is_system, created_by)
       VALUES (?, ?, ?, ?, FALSE, ?)`,
      [caseId, parentFolderId, name.trim(), description ? description.trim() : null, userId]
    );

    return { id: res.insertId, case_id: caseId, name: name.trim() };
  }

  /**
   * Update folder
   */
  async updateFolder(folderId, { name, description }) {
    const [existing] = await db.query(`SELECT * FROM document_folders WHERE id = ?`, [folderId]);
    if (existing.length === 0) {
      const err = new Error('Folder not found.');
      err.statusCode = 404;
      throw err;
    }

    await db.query(
      `UPDATE document_folders SET 
         name = COALESCE(?, name),
         description = COALESCE(?, description)
       WHERE id = ?`,
      [name ? name.trim() : null, description !== undefined ? description : null, folderId]
    );

    return { id: folderId, success: true };
  }

  /**
   * Archive folder
   */
  async archiveFolder(folderId) {
    await db.query(
      `UPDATE document_folders SET archived_at = NOW() WHERE id = ?`,
      [folderId]
    );
    return { id: folderId, success: true };
  }
}

module.exports = new DocumentFolderService();
