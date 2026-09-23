const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function hasColumn(table, column) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function runLegalDocumentMigration() {
  console.log('[Document Migration]: Verifying and upgrading legal document management schema...');

  const connection = await db.getConnection();

  try {
    // 1. Alter existing `documents` table
    console.log('[Document Migration]: Updating documents table...');
    // Modify case_id to be NULLABLE
    try {
      await connection.query(`ALTER TABLE documents MODIFY case_id INT NULL`);
    } catch (err) {
      // Ignore if already modified
    }

    if (!(await hasColumn('documents', 'contact_id'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN contact_id INT NULL AFTER client_id`);
      await connection.query(`ALTER TABLE documents ADD CONSTRAINT fk_documents_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL`);
    }

    if (!(await hasColumn('documents', 'workforce_id'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN workforce_id INT NULL AFTER contact_id`);
      await connection.query(`ALTER TABLE documents ADD CONSTRAINT fk_documents_workforce FOREIGN KEY (workforce_id) REFERENCES workforce_profiles(id) ON DELETE SET NULL`);
    }

    if (!(await hasColumn('documents', 'folder_id'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN folder_id INT NULL AFTER workforce_id`);
    }

    if (!(await hasColumn('documents', 'document_type_id'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN document_type_id INT NULL AFTER folder_id`);
    }

    if (!(await hasColumn('documents', 'document_number'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN document_number VARCHAR(100) UNIQUE NULL AFTER document_type_id`);
    }

    if (!(await hasColumn('documents', 'source'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN source ENUM('UPLOADED', 'CREATED_FROM_TEMPLATE', 'GENERATED', 'CLIENT_UPLOADED', 'COURT_UPLOADED', 'SIGNED', 'IMPORTED', 'OTHER') NOT NULL DEFAULT 'UPLOADED' AFTER document_number`);
    }

    if (!(await hasColumn('documents', 'status'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN status ENUM('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'READY_FOR_SIGNATURE', 'SIGNATURE_PENDING', 'SIGNED', 'REJECTED', 'ARCHIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT' AFTER source`);
    }

    if (!(await hasColumn('documents', 'owner_user_id'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN owner_user_id INT NULL AFTER current_version_id`);
      await connection.query(`ALTER TABLE documents ADD CONSTRAINT fk_documents_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL`);
    }

    if (!(await hasColumn('documents', 'approved_by'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN approved_by INT NULL AFTER owner_user_id`);
      await connection.query(`ALTER TABLE documents ADD CONSTRAINT fk_documents_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL`);
    }

    if (!(await hasColumn('documents', 'approved_at'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN approved_at DATETIME NULL AFTER approved_by`);
    }

    if (!(await hasColumn('documents', 'signed_at'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN signed_at DATETIME NULL AFTER approved_at`);
    }

    if (!(await hasColumn('documents', 'archived_at'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN archived_at DATETIME NULL AFTER signed_at`);
    }

    if (!(await hasColumn('documents', 'retention_until'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN retention_until DATE NULL AFTER archived_at`);
    }

    if (!(await hasColumn('documents', 'retention_policy'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN retention_policy VARCHAR(100) NULL AFTER retention_until`);
    }

    if (!(await hasColumn('documents', 'is_locked'))) {
      await connection.query(`ALTER TABLE documents ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE AFTER retention_policy`);
    }

    // 2. Alter existing `document_shares` table
    console.log('[Document Migration]: Updating document_shares table...');
    if (!(await hasColumn('document_shares', 'shared_with_client_id'))) {
      await connection.query(`ALTER TABLE document_shares ADD COLUMN shared_with_client_id INT NULL AFTER shared_with_user_id`);
      await connection.query(`ALTER TABLE document_shares ADD CONSTRAINT fk_doc_shares_client FOREIGN KEY (shared_with_client_id) REFERENCES clients(id) ON DELETE CASCADE`);
    }

    if (!(await hasColumn('document_shares', 'shared_with_contact_id'))) {
      await connection.query(`ALTER TABLE document_shares ADD COLUMN shared_with_contact_id INT NULL AFTER shared_with_client_id`);
      await connection.query(`ALTER TABLE document_shares ADD CONSTRAINT fk_doc_shares_contact FOREIGN KEY (shared_with_contact_id) REFERENCES contacts(id) ON DELETE CASCADE`);
    }

    if (!(await hasColumn('document_shares', 'share_token'))) {
      await connection.query(`ALTER TABLE document_shares ADD COLUMN share_token VARCHAR(64) UNIQUE NULL AFTER shared_with_contact_id`);
    }

    if (!(await hasColumn('document_shares', 'password_hash'))) {
      await connection.query(`ALTER TABLE document_shares ADD COLUMN password_hash VARCHAR(255) NULL AFTER share_token`);
    }

    if (!(await hasColumn('document_shares', 'access_count'))) {
      await connection.query(`ALTER TABLE document_shares ADD COLUMN access_count INT NOT NULL DEFAULT 0 AFTER password_hash`);
    }

    if (!(await hasColumn('document_shares', 'max_access_count'))) {
      await connection.query(`ALTER TABLE document_shares ADD COLUMN max_access_count INT NULL AFTER access_count`);
    }

    if (!(await hasColumn('document_shares', 'revoked_by'))) {
      await connection.query(`ALTER TABLE document_shares ADD COLUMN revoked_by INT NULL AFTER revoked_at`);
      await connection.query(`ALTER TABLE document_shares ADD CONSTRAINT fk_doc_shares_revoked_by FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL`);
    }

    // 3. Alter existing `document_signature_requests` table
    console.log('[Document Migration]: Updating document_signature_requests table...');
    if (!(await hasColumn('document_signature_requests', 'request_code'))) {
      await connection.query(`ALTER TABLE document_signature_requests ADD COLUMN request_code VARCHAR(50) UNIQUE NULL AFTER id`);
    }

    if (!(await hasColumn('document_signature_requests', 'provider_request_id'))) {
      await connection.query(`ALTER TABLE document_signature_requests ADD COLUMN provider_request_id VARCHAR(150) NULL AFTER provider`);
    }

    try {
      await connection.query(`ALTER TABLE document_signature_requests MODIFY COLUMN provider ENUM('DIGIO', 'LEEGALITY', 'MOCK') NOT NULL DEFAULT 'MOCK'`);
      await connection.query(`ALTER TABLE document_signature_requests MODIFY COLUMN status ENUM('DRAFT', 'REQUESTED', 'SENT', 'VIEWED', 'PARTIALLY_SIGNED', 'SIGNED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'DRAFT'`);
    } catch (err) {
      console.warn('[Document Migration]: Enum modify warn:', err.message);
    }

    if (!(await hasColumn('document_signature_requests', 'signing_order'))) {
      await connection.query(`ALTER TABLE document_signature_requests ADD COLUMN signing_order ENUM('SEQUENTIAL', 'PARALLEL') NOT NULL DEFAULT 'PARALLEL' AFTER status`);
    }

    if (!(await hasColumn('document_signature_requests', 'expires_at'))) {
      await connection.query(`ALTER TABLE document_signature_requests ADD COLUMN expires_at DATETIME NULL AFTER requested_by`);
    }

    if (!(await hasColumn('document_signature_requests', 'completed_at'))) {
      await connection.query(`ALTER TABLE document_signature_requests ADD COLUMN completed_at DATETIME NULL AFTER expires_at`);
    }

    if (!(await hasColumn('document_signature_requests', 'cancelled_at'))) {
      await connection.query(`ALTER TABLE document_signature_requests ADD COLUMN cancelled_at DATETIME NULL AFTER completed_at`);
    }

    if (!(await hasColumn('document_signature_requests', 'failure_reason'))) {
      await connection.query(`ALTER TABLE document_signature_requests ADD COLUMN failure_reason TEXT NULL AFTER cancelled_at`);
    }

    if (!(await hasColumn('document_signature_requests', 'metadata'))) {
      await connection.query(`ALTER TABLE document_signature_requests ADD COLUMN metadata JSON NULL AFTER failure_reason`);
    }

    if (!(await hasColumn('document_signature_requests', 'updated_at'))) {
      await connection.query(`ALTER TABLE document_signature_requests ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
    }

    // 4. Run legal_document_schema.sql DDL statements
    console.log('[Document Migration]: Running legal_document_schema.sql DDL...');
    const schemaSqlPath = path.join(__dirname, 'legal_document_schema.sql');
    if (fs.existsSync(schemaSqlPath)) {
      const sqlContent = fs.readFileSync(schemaSqlPath, 'utf8');
      const cleanedSql = sqlContent.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '');
      const statements = cleanedSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.toLowerCase().startsWith('use '));

      for (const statement of statements) {
        try {
          await connection.query(statement);
        } catch (stmtErr) {
          if (!stmtErr.message.includes('already exists')) {
            console.warn('[Document Migration DDL Warning]:', stmtErr.message);
          }
        }
      }
    }

    // Add folder_id foreign key constraint now that document_folders is guaranteed to exist
    try {
      await connection.query(`ALTER TABLE documents ADD CONSTRAINT fk_documents_folder FOREIGN KEY (folder_id) REFERENCES document_folders(id) ON DELETE SET NULL`);
    } catch (e) {
      // Ignore if constraint already exists
    }

    try {
      await connection.query(`ALTER TABLE documents ADD CONSTRAINT fk_documents_type FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE SET NULL`);
    } catch (e) {
      // Ignore if constraint already exists
    }

    // 5. Seed Document Types
    console.log('[Document Migration]: Seeding standard legal document types...');
    const standardDocTypes = [
      { code: 'PLEADING', name: 'Pleading', description: 'Court pleadings and formal claims', requires_advocate_approval: true, default_folder_name: 'Pleadings' },
      { code: 'PETITION', name: 'Petition', description: 'Original / Special Leave petitions', requires_advocate_approval: true, default_folder_name: 'Pleadings' },
      { code: 'PLAINT', name: 'Plaint / Statement of Claim', description: 'Civil suit plaints', requires_advocate_approval: true, default_folder_name: 'Pleadings' },
      { code: 'WRITTEN_STATEMENT', name: 'Written Statement', description: 'Defendant formal reply', requires_advocate_approval: true, default_folder_name: 'Pleadings' },
      { code: 'BAIL_APPLICATION', name: 'Bail Application', description: 'Regular or Anticipatory bail application', requires_advocate_approval: true, default_folder_name: 'Applications' },
      { code: 'VAKALATNAMA', name: 'Vakalatnama', description: 'Advocate authorization and power of attorney', requires_advocate_approval: false, requires_esign: true, default_folder_name: 'Vakalatnama' },
      { code: 'AFFIDAVIT', name: 'Affidavit under Oath', description: 'Sworn legal statements', requires_advocate_approval: true, requires_esign: true, default_folder_name: 'Affidavits' },
      { code: 'LEGAL_NOTICE', name: 'Legal Notice', description: 'Formal statutory / pre-litigation notice', requires_advocate_approval: true, default_folder_name: 'Correspondence' },
      { code: 'REPLY', name: 'Reply / Rejoinder', description: 'Reply to notice or application', requires_advocate_approval: true, default_folder_name: 'Correspondence' },
      { code: 'APPLICATION', name: 'Interlocutory Application', description: 'Interim applications & stays', requires_advocate_approval: true, default_folder_name: 'Applications' },
      { code: 'MEMO', name: 'Memo / Appearance', description: 'Memo of appearance or address', requires_advocate_approval: false, default_folder_name: 'Applications' },
      { code: 'AGREEMENT', name: 'Legal Agreement / Contract', description: 'Client retainers, settlements, and agreements', requires_advocate_approval: true, requires_esign: true, default_folder_name: 'Agreements' },
      { code: 'AUTHORIZATION', name: 'Letter of Authorization', description: 'Authority letters and resolutions', requires_advocate_approval: false, requires_esign: true, default_folder_name: 'Agreements' },
      { code: 'COURT_ORDER', name: 'Court Order / Roznama', description: 'Daily proceedings and interim orders', requires_advocate_approval: false, default_folder_name: 'Court_Orders' },
      { code: 'JUDGMENT', name: 'Final Judgment / Decree', description: 'Disposal judgment copies', requires_advocate_approval: false, default_folder_name: 'Court_Orders' },
      { code: 'EVIDENCE', name: 'Evidence / Exhibit', description: 'Documentary evidence and proof', requires_advocate_approval: false, default_folder_name: 'Evidence' },
      { code: 'CASE_DOCUMENT', name: 'General Case Document', description: 'General case papers', requires_advocate_approval: false, default_folder_name: 'Other' },
      { code: 'CLIENT_DOCUMENT', name: 'Client Identification / KYC', description: 'Aadhaar, PAN, Incorporation papers', requires_advocate_approval: false, default_folder_name: 'Other' },
      { code: 'INTERNAL_NOTE', name: 'Internal Legal Strategy Note', description: 'Privileged counsel notes', requires_advocate_approval: false, default_folder_name: 'Other' },
      { code: 'CORRESPONDENCE', name: 'Chambers Correspondence', description: 'Formal emails and letters', requires_advocate_approval: false, default_folder_name: 'Correspondence' },
      { code: 'OTHER', name: 'Other Documents', description: 'Miscellaneous legal documents', requires_advocate_approval: false, default_folder_name: 'Other' }
    ];

    for (const dt of standardDocTypes) {
      await connection.query(
        `INSERT INTO document_types (code, name, description, is_system, is_active, requires_advocate_approval, requires_esign, default_folder_name)
         VALUES (?, ?, ?, TRUE, TRUE, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           name = VALUES(name), 
           description = VALUES(description),
           requires_advocate_approval = VALUES(requires_advocate_approval),
           requires_esign = VALUES(requires_esign),
           default_folder_name = VALUES(default_folder_name)`,
        [dt.code, dt.name, dt.description, dt.requires_advocate_approval || false, dt.requires_esign || false, dt.default_folder_name]
      );
    }

    // 6. Seed Default Legal Document Templates
    console.log('[Document Migration]: Seeding standard legal document templates...');
    const [bailType] = await connection.query(`SELECT id FROM document_types WHERE code = 'BAIL_APPLICATION' LIMIT 1`);
    const [noticeType] = await connection.query(`SELECT id FROM document_types WHERE code = 'LEGAL_NOTICE' LIMIT 1`);
    const [vakalatType] = await connection.query(`SELECT id FROM document_types WHERE code = 'VAKALATNAMA' LIMIT 1`);
    const [affidavitType] = await connection.query(`SELECT id FROM document_types WHERE code = 'AFFIDAVIT' LIMIT 1`);

    const defaultTemplates = [
      {
        code: 'TPL-BAIL-001',
        name: 'Regular Bail Application u/s 437/439 Cr.P.C.',
        description: 'Standard application for bail before Court of Session / High Court with grounds of defense and surety undertaking.',
        document_type_id: bailType[0]?.id || null,
        case_type: 'CRIMINAL',
        variables: JSON.stringify([
          'CLIENT_NAME', 'COURT_NAME', 'CASE_NUMBER', 'FIR_NUMBER', 
          'POLICE_STATION', 'OFFENCES_CHARGED', 'ADVOCATE_NAME', 'DATE'
        ]),
        content: `IN THE COURT OF {{COURT_NAME}}
IN THE MATTER OF:
CASE NO: {{CASE_NUMBER}}
FIR NO: {{FIR_NUMBER}}
POLICE STATION: {{POLICE_STATION}}
UNDER SECTIONS: {{OFFENCES_CHARGED}}

{{CLIENT_NAME}} ... APPLICANT / ACCUSED
VERSUS
STATE OF ... PROSECUTION / RESPONDENT

APPLICATION UNDER SECTION 437/439 OF THE CODE OF CRIMINAL PROCEDURE FOR GRANT OF REGULAR BAIL ON BEHALF OF THE APPLICANT

MOST RESPECTFULLY SHOWETH:
1. That the Applicant has been falsely implicated in the above-mentioned FIR registered at Police Station {{POLICE_STATION}}.
2. That the Applicant is a law-abiding citizen with deep roots in society and no prior criminal antecedents.
3. That the custodial interrogation of the Applicant is no longer required as investigation is substantially complete.
4. That the Applicant undertakes to abide by all conditions imposed by this Hon'ble Court and shall not tamper with evidence.

PRAYER:
Wherefore, it is respectfully prayed that this Hon'ble Court may graciously be pleased to enlarge the Applicant {{CLIENT_NAME}} on bail in FIR No. {{FIR_NUMBER}}, P.S. {{POLICE_STATION}}, in the interest of justice.

ADVOCATE FOR APPLICANT: {{ADVOCATE_NAME}}
DATED: {{DATE}}`
      },
      {
        code: 'TPL-NOTICE-138',
        name: 'Statutory Demand Notice u/s 138 Negotiable Instruments Act',
        description: 'Formal legal notice demanding payment within 15 days upon cheque dishonour.',
        document_type_id: noticeType[0]?.id || null,
        case_type: 'COMMERCIAL',
        variables: JSON.stringify([
          'CLIENT_NAME', 'OPPOSING_PARTY', 'CHEQUE_NUMBER', 'CHEQUE_DATE', 
          'CHEQUE_AMOUNT', 'BANK_NAME', 'DISHONOUR_REASON', 'ADVOCATE_NAME', 'DATE'
        ]),
        content: `LEGAL DEMAND NOTICE UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881

TO:
{{OPPOSING_PARTY}}

UNDER INSTRUCTIONS AND ON BEHALF OF MY CLIENT:
{{CLIENT_NAME}}

SIR / MADAM,
Under instructions from and on behalf of my client {{CLIENT_NAME}}, I hereby serve upon you the following statutory legal demand notice:
1. That towards discharge of your legally enforceable debt and liability, you issued Cheque No. {{CHEQUE_NUMBER}} dated {{CHEQUE_DATE}} for an amount of ₹{{CHEQUE_AMOUNT}} drawn on {{BANK_NAME}}.
2. That when my client presented the said cheque for encashment, the same was returned dishonoured with remark '{{DISHONOUR_REASON}}'.
3. I hereby call upon you to pay the sum of ₹{{CHEQUE_AMOUNT}} within fifteen (15) days of receipt of this notice, failing which my client shall initiate criminal prosecution against you under Section 138 of the Negotiable Instruments Act.

ADVOCATE: {{ADVOCATE_NAME}}
DATE: {{DATE}}`
      },
      {
        code: 'TPL-VAKALAT-001',
        name: 'Standard Vakalatnama (Advocate Power of Attorney)',
        description: 'Official authorization letter empowering advocate to appear, plead, and act.',
        document_type_id: vakalatType[0]?.id || null,
        case_type: null,
        variables: JSON.stringify([
          'CLIENT_NAME', 'COURT_NAME', 'CASE_TITLE', 'CASE_NUMBER', 'ADVOCATE_NAME', 'DATE'
        ]),
        content: `VAKALATNAMA
IN THE COURT OF: {{COURT_NAME}}
CASE NUMBER: {{CASE_NUMBER}}
TITLE: {{CASE_TITLE}}

KNOW ALL to whom these presents shall come that I/We, {{CLIENT_NAME}}, do hereby appoint:
{{ADVOCATE_NAME}}, Advocate(s)
to be my/our Advocate(s) in the above-mentioned case, to appear, plead, act, file appeals, make compromise, and withdraw funds on my/our behalf.

EXECUTANT / CLIENT: {{CLIENT_NAME}}
ACCEPTED: {{ADVOCATE_NAME}}
DATED: {{DATE}}`
      },
      {
        code: 'TPL-AFFIDAVIT-001',
        name: 'General Verification Affidavit under Oath',
        description: 'Solemn affirmation verifying contents of petition or application.',
        document_type_id: affidavitType[0]?.id || null,
        case_type: null,
        variables: JSON.stringify([
          'CLIENT_NAME', 'CLIENT_ADDRESS', 'COURT_NAME', 'CASE_TITLE', 'DATE'
        ]),
        content: `AFFIDAVIT
BEFORE THE HON'BLE COURT OF {{COURT_NAME}}
IN THE MATTER OF: {{CASE_TITLE}}

I, {{CLIENT_NAME}}, residing at {{CLIENT_ADDRESS}}, do hereby solemnly affirm and state on oath as under:
1. That I am the Petitioner / Deponent in the accompanying matter and am fully conversant with the facts of the case.
2. That the statements made in paragraphs 1 to end of the petition are true to my knowledge and based on records believed to be correct.
3. That no part of this affidavit is false and nothing material has been concealed therefrom.

DEPONENT: {{CLIENT_NAME}}
VERIFICATION:
Verified at on this {{DATE}} that contents of above affidavit are true and correct.
DEPONENT`
      }
    ];

    for (const tpl of defaultTemplates) {
      await connection.query(
        `INSERT INTO document_templates (template_code, name, description, document_type_id, case_type, content, variables, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           description = VALUES(description),
           document_type_id = VALUES(document_type_id),
           case_type = VALUES(case_type),
           content = VALUES(content),
           variables = VALUES(variables),
           status = 'ACTIVE'`,
        [tpl.code, tpl.name, tpl.description, tpl.document_type_id, tpl.case_type, tpl.content, tpl.variables]
      );
    }

    // 7. Seed Default Tags
    console.log('[Document Migration]: Seeding standard document tags...');
    const defaultTags = [
      { name: 'URGENT', color: '#dc2626' },
      { name: 'COURT', color: '#2563eb' },
      { name: 'CLIENT', color: '#059669' },
      { name: 'EVIDENCE', color: '#d97706' },
      { name: 'CONFIDENTIAL', color: '#7c3aed' },
      { name: 'SIGNED', color: '#16a34a' },
      { name: 'IMPORTANT', color: '#ea580c' },
      { name: 'PENDING_REVIEW', color: '#0284c7' }
    ];

    for (const tag of defaultTags) {
      await connection.query(
        `INSERT INTO document_tags (name, color) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE color = VALUES(color)`,
        [tag.name, tag.color]
      );
    }

    // 8. Seed Default Retention Policies
    console.log('[Document Migration]: Seeding default retention policies...');
    const defaultRetention = [
      { name: 'General Case Records', retention_years: 7, action_after: 'ARCHIVE', description: 'Standard 7-year retention period after case disposal.' },
      { name: 'Court Orders & Decrees', retention_years: 30, action_after: 'ARCHIVE', description: 'Long-term retention for certified decrees and final orders.' },
      { name: 'Internal Drafts & Working Notes', retention_years: 3, action_after: 'REVIEW_BEFORE_PURGE', description: 'Review before archiving temporary drafts.' }
    ];

    for (const ret of defaultRetention) {
      await connection.query(
        `INSERT IGNORE INTO document_retention_policies (name, retention_years, action_after, description)
         VALUES (?, ?, ?, ?)`,
        [ret.name, ret.retention_years, ret.action_after, ret.description]
      );
    }

    // 9. Register Prompt 11 Permissions
    console.log('[Document Migration]: Registering Prompt 11 document permissions...');
    const permissionsToSeed = [
      { name: 'DOCUMENT_REVIEW_REQUEST', category: 'DOCUMENTS', description: 'Submit documents for internal review' },
      { name: 'DOCUMENT_REVIEW', category: 'DOCUMENTS', description: 'Review and add comments to documents' },
      { name: 'DOCUMENT_APPROVE', category: 'DOCUMENTS', description: 'Grant final approval to legal documents' },
      { name: 'DOCUMENT_REJECT', category: 'DOCUMENTS', description: 'Reject document reviews' },
      { name: 'DOCUMENT_TEMPLATE_VIEW', category: 'DOCUMENTS', description: 'View legal document templates' },
      { name: 'DOCUMENT_TEMPLATE_CREATE', category: 'DOCUMENTS', description: 'Create new legal document templates' },
      { name: 'DOCUMENT_TEMPLATE_UPDATE', category: 'DOCUMENTS', description: 'Edit legal document templates' },
      { name: 'DOCUMENT_TEMPLATE_ARCHIVE', category: 'DOCUMENTS', description: 'Archive legal document templates' },
      { name: 'DOCUMENT_SIGNATURE_REQUEST', category: 'DOCUMENTS', description: 'Initiate e-signature requests' },
      { name: 'DOCUMENT_SIGNATURE_VIEW', category: 'DOCUMENTS', description: 'View signature status and signed documents' },
      { name: 'DOCUMENT_SIGNATURE_CANCEL', category: 'DOCUMENTS', description: 'Cancel pending e-signature requests' },
      { name: 'DOCUMENT_SIGNATURE_DOWNLOAD', category: 'DOCUMENTS', description: 'Download legally signed document artifacts' },
      { name: 'DOCUMENT_SETTINGS_MANAGE', category: 'DOCUMENTS', description: 'Manage document types, folders, and retention settings' },
      { name: 'DOCUMENT_SEARCH', category: 'DOCUMENTS', description: 'Access advanced document and full-text search' }
    ];

    for (const perm of permissionsToSeed) {
      await connection.query(
        `INSERT IGNORE INTO permissions (name, category, description, created_at)
         VALUES (?, ?, ?, NOW())`,
        [perm.name, perm.category, perm.description]
      );
    }

    // Map permissions to OWNER role
    await connection.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r, permissions p 
       WHERE r.name = 'OWNER' AND p.category = 'DOCUMENTS'`
    );

    // Map to SENIOR_ASSOCIATE (All except SETTINGS_MANAGE)
    await connection.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r, permissions p 
       WHERE r.name = 'SENIOR_ASSOCIATE' AND p.category = 'DOCUMENTS' AND p.name != 'DOCUMENT_SETTINGS_MANAGE'`
    );

    // Map to JUNIOR_ASSOCIATE (Limited to view, review request, template view, signature view)
    await connection.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r, permissions p 
       WHERE r.name = 'JUNIOR_ASSOCIATE' AND p.name IN (
         'DOCUMENT_REVIEW_REQUEST', 'DOCUMENT_TEMPLATE_VIEW', 'DOCUMENT_SIGNATURE_VIEW', 'DOCUMENT_SEARCH'
       )`
    );

    console.log('[Document Migration]: Legal document management schema upgrade completed successfully.');
  } catch (error) {
    console.error('[Document Migration Error]:', error);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = runLegalDocumentMigration;
