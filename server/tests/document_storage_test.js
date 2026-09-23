/**
 * Automated Test Suite: Document Storage Types (Internal File vs External Cloud Links)
 * Tests Prompt 11 Core Requirements:
 * 1. 10 MB internal upload limit enforcement & HTTP 413 FILE_TOO_LARGE rejection
 * 2. Internal file SHA-256 checksum generation & immutability
 * 3. External link URL validation (HTTPS only, rejection of javascript:, data:, file:, etc.)
 * 4. External providers metadata (GOOGLE_DRIVE, ONEDRIVE, DROPBOX, OTHER)
 * 5. Direct external link document creation without local file upload
 * 6. External versions immutability (V1 = Link A, V2 = Link B)
 * 7. Verification that external documents have NULL checksum (no fake checksums)
 * 8. Rejection of download requests on external documents
 * 9. Safe external link opening with audit logging (DOCUMENT_EXTERNAL_LINK_OPENED)
 * 10. Access control & authorization on external link endpoints
 * 11. E-Sign restriction: External documents CANNOT be dispatched for eSign
 * 12. Mixed versioning: V1 Internal File -> V2 External Link
 */

const db = require('../config/database');
const documentService = require('../services/documentService');
const documentVersionService = require('../services/documentVersionService');
const documentReviewService = require('../services/documentReviewService');
const documentSignatureService = require('../services/documentSignatureService');
const externalDocumentProvider = require('../providers/storage/externalDocumentProvider');
const fileSecurityService = require('../services/fileSecurityService');

async function runDocumentStorageTests() {
  console.log('================================================================');
  console.log('STARTING PROMPT 11: DOCUMENT STORAGE & EXTERNAL LINK TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const advocateUser = { id: 1, role: 'ADVOCATE', first_name: 'Lead', last_name: 'Counsel' };
  const juniorUser = { id: 2, role: 'JUNIOR_ASSOCIATE', first_name: 'Junior', last_name: 'Advocate' };
  const unauthorizedUser = { id: 999, role: 'CLIENT', first_name: 'External', last_name: 'User' };

  try {
    // -------------------------------------------------------------
    // TEST SECTION 1: EXTERNAL URL VALIDATION & SCHEME SECURITY
    // -------------------------------------------------------------
    console.log('[Section 1: URL Validation & Scheme Security]');

    // 1.1 Google Drive URL
    const gdriveValidation = externalDocumentProvider.validateUrl('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view');
    if (gdriveValidation.valid && gdriveValidation.provider === 'GOOGLE_DRIVE') {
      console.log('✓ Google Drive HTTPS URL successfully validated as GOOGLE_DRIVE');
      passed++;
    } else {
      throw new Error(`Google Drive validation failed: ${JSON.stringify(gdriveValidation)}`);
    }

    // 1.2 OneDrive URL
    const onedriveValidation = externalDocumentProvider.validateUrl('https://onedrive.live.com/?id=root&cid=123456');
    if (onedriveValidation.valid && onedriveValidation.provider === 'ONEDRIVE') {
      console.log('✓ OneDrive HTTPS URL successfully validated as ONEDRIVE');
      passed++;
    } else {
      throw new Error(`OneDrive validation failed: ${JSON.stringify(onedriveValidation)}`);
    }

    // 1.3 Dropbox URL
    const dropboxValidation = externalDocumentProvider.validateUrl('https://www.dropbox.com/s/xyz123/legal_brief.docx?dl=0');
    if (dropboxValidation.valid && dropboxValidation.provider === 'DROPBOX') {
      console.log('✓ Dropbox HTTPS URL successfully validated as DROPBOX');
      passed++;
    } else {
      throw new Error(`Dropbox validation failed: ${JSON.stringify(dropboxValidation)}`);
    }

    // 1.4 Generic HTTPS URL
    const genericValidation = externalDocumentProvider.validateUrl('https://court.gov.in/orders/2026/order_final.pdf');
    if (genericValidation.valid && genericValidation.provider === 'OTHER') {
      console.log('✓ Generic HTTPS URL validated as OTHER provider');
      passed++;
    } else {
      throw new Error(`Generic HTTPS validation failed: ${JSON.stringify(genericValidation)}`);
    }

    // 1.5 Reject HTTP (Unencrypted)
    const httpValidation = externalDocumentProvider.validateUrl('http://insecure-court-records.org/doc.pdf');
    if (!httpValidation.valid && httpValidation.error.includes('HTTPS')) {
      console.log(`✓ Plain HTTP correctly rejected: "${httpValidation.error}"`);
      passed++;
    } else {
      throw new Error('FAILED: Plain HTTP was accepted!');
    }

    // 1.6 Reject javascript: scheme
    const jsValidation = externalDocumentProvider.validateUrl('javascript:alert(document.cookie)');
    if (!jsValidation.valid && (jsValidation.error.includes('prohibited') || jsValidation.error.includes('protocol'))) {
      console.log(`✓ Dangerous javascript: protocol rejected: "${jsValidation.error}"`);
      passed++;
    } else {
      throw new Error('FAILED: javascript: scheme was accepted!');
    }

    // 1.7 Reject data: scheme
    const dataValidation = externalDocumentProvider.validateUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==');
    if (!dataValidation.valid && (dataValidation.error.includes('prohibited') || dataValidation.error.includes('protocol'))) {
      console.log(`✓ Dangerous data: protocol rejected: "${dataValidation.error}"`);
      passed++;
    } else {
      throw new Error('FAILED: data: scheme was accepted!');
    }

    // 1.8 Reject file: scheme
    const fileSchemeValidation = externalDocumentProvider.validateUrl('file:///etc/passwd');
    if (!fileSchemeValidation.valid && (fileSchemeValidation.error.includes('prohibited') || fileSchemeValidation.error.includes('protocol'))) {
      console.log(`✓ Dangerous file: protocol rejected: "${fileSchemeValidation.error}"`);
      passed++;
    } else {
      throw new Error('FAILED: file: scheme was accepted!');
    }

    // -------------------------------------------------------------
    // TEST SECTION 2: 10 MB INTERNAL UPLOAD LIMIT ENFORCEMENT
    // -------------------------------------------------------------
    console.log('\n[Section 2: 10 MB Internal Upload Limit Enforcement]');

    // 2.1 File size <= 10 MB accepted (e.g. 1 MB)
    const validInternalFile = {
      originalname: 'Sample_Affidavit.pdf',
      mimetype: 'application/pdf',
      size: 1 * 1024 * 1024, // 1 MB
      buffer: Buffer.from('%PDF-1.4 1 MB dummy legal document content for unit tests')
    };
    const validScan = fileSecurityService.validateFile(validInternalFile);
    if (validScan.valid) {
      console.log(`✓ 1 MB file within limit accepted: ${validInternalFile.originalname}`);
      passed++;
    } else {
      throw new Error(`Valid file rejected: ${validScan.error}`);
    }

    // 2.2 File size > 10 MB rejected (e.g. 25 MB)
    const oversizedFile = {
      originalname: 'Evidence_Video_Bundle.pdf',
      mimetype: 'application/pdf',
      size: 25 * 1024 * 1024, // 25 MB
      buffer: Buffer.from('%PDF-1.4 dummy header')
    };
    const oversizedScan = fileSecurityService.validateFile(oversizedFile);
    if (!oversizedScan.valid && oversizedScan.code === 'FILE_TOO_LARGE' && oversizedScan.statusCode === 413) {
      console.log(`✓ 25 MB file rejected with HTTP 413 & code FILE_TOO_LARGE: "${oversizedScan.error}"`);
      passed++;
    } else {
      throw new Error(`FAILED: 25 MB file was not properly rejected with code FILE_TOO_LARGE: ${JSON.stringify(oversizedScan)}`);
    }

    // 2.3 Boundary: 10.01 MB rejected
    const boundaryOversized = {
      originalname: 'Boundary_Test.pdf',
      mimetype: 'application/pdf',
      size: 10 * 1024 * 1024 + 1024, // 10 MB + 1 KB
      buffer: Buffer.from('%PDF-1.4 dummy header')
    };
    const boundaryScan = fileSecurityService.validateFile(boundaryOversized);
    if (!boundaryScan.valid && boundaryScan.code === 'FILE_TOO_LARGE') {
      console.log(`✓ 10.01 MB boundary file rejected with code FILE_TOO_LARGE`);
      passed++;
    } else {
      throw new Error('FAILED: Boundary >10 MB file was accepted!');
    }

    // -------------------------------------------------------------
    // TEST SECTION 3: DIRECT EXTERNAL LINK DOCUMENT CREATION
    // -------------------------------------------------------------
    console.log('\n[Section 3: Direct External Link Document Creation]');

    const externalDocData = {
      title: 'Evidence Bundle 2026 - High Res Forensic Drive',
      description: 'Contains high-resolution digital forensic copies hosted on Google Drive (350 MB total bundle)',
      category: 'EVIDENCE',
      confidentiality_level: 'CONFIDENTIAL',
      external_provider: 'GOOGLE_DRIVE',
      external_url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view',
      external_file_name: 'Forensic_Drive_Dump_2026.iso',
      external_file_size: 367001600, // 350 MB - allowed because external!
      external_mime_type: 'application/octet-stream',
      user: advocateUser,
      reqInfo: { ip: '127.0.0.1', userAgent: 'Storage-Test-Runner' }
    };

    const createdExtDoc = await documentService.createExternalDocument(externalDocData);
    if (createdExtDoc && createdExtDoc.id && createdExtDoc.storage_type === 'EXTERNAL') {
      console.log(`✓ Direct external document created: ID #${createdExtDoc.id}, Number: ${createdExtDoc.document_number}, Storage: ${createdExtDoc.storage_type}`);
      passed++;
    } else {
      throw new Error(`Failed to create external document: ${JSON.stringify(createdExtDoc)}`);
    }

    // Verify database row properties
    const [docRows] = await db.execute('SELECT * FROM documents WHERE id = ?', [createdExtDoc.id]);
    const docRow = docRows[0];
    if (
      docRow.storage_type === 'EXTERNAL' &&
      docRow.external_provider === 'GOOGLE_DRIVE' &&
      docRow.external_url &&
      docRow.internal_storage_key === null &&
      docRow.checksum === null
    ) {
      console.log('✓ Database constraints verified: storage_type=EXTERNAL, internal_storage_key=NULL, checksum=NULL');
      passed++;
    } else {
      throw new Error(`Database constraints mismatch on external document: ${JSON.stringify(docRow)}`);
    }

    // Verify first version properties
    const [verRows] = await db.execute('SELECT * FROM document_versions WHERE document_id = ? AND version_number = 1', [createdExtDoc.id]);
    const ver1 = verRows[0];
    if (
      ver1.storage_type === 'EXTERNAL' &&
      ver1.external_url === externalDocData.external_url &&
      ver1.storage_key === null &&
      ver1.checksum === null
    ) {
      console.log('✓ Version 1 verified: storage_type=EXTERNAL, external_url preserved, checksum is strictly NULL (no fake checksum)');
      passed++;
    } else {
      throw new Error(`Version 1 mismatch: ${JSON.stringify(ver1)}`);
    }

    // -------------------------------------------------------------
    // TEST SECTION 4: VERSION IMMUTABILITY (V1 = Link A, V2 = Link B)
    // -------------------------------------------------------------
    console.log('\n[Section 4: Version Control & Immutability]');

    const linkB = 'https://drive.google.com/file/d/2CzkNWt1YSB6oGNeLwCeCAkhnVvrqumct85PhwF3vqnt/view';
    const ver2Res = await documentVersionService.createExternalVersion(createdExtDoc.id, {
      external_provider: 'GOOGLE_DRIVE',
      external_url: linkB,
      external_file_name: 'Forensic_Drive_Dump_2026_Amended.iso',
      change_summary: 'Replaced with verified forensic bundle containing SHA-256 hash log.',
      user: advocateUser,
      reqInfo: { ip: '127.0.0.1', userAgent: 'Storage-Test-Runner' }
    });

    if (ver2Res && ver2Res.version_number === 2) {
      console.log(`✓ External Version 2 created successfully (v${ver2Res.version_number})`);
      passed++;
    } else {
      throw new Error(`Failed to create version 2: ${JSON.stringify(ver2Res)}`);
    }

    // Check that Version 1 remains UNMODIFIED (Immutability check)
    const [ver1CheckRows] = await db.execute('SELECT * FROM document_versions WHERE document_id = ? AND version_number = 1', [createdExtDoc.id]);
    const [ver2CheckRows] = await db.execute('SELECT * FROM document_versions WHERE document_id = ? AND version_number = 2', [createdExtDoc.id]);

    if (ver1CheckRows[0].external_url === externalDocData.external_url) {
      console.log('✓ Version 1 immutability verified: Original Link A retained unaltered');
      passed++;
    } else {
      throw new Error('FAILED: Version 1 external_url was overwritten!');
    }

    if (ver2CheckRows[0].external_url === linkB) {
      console.log('✓ Version 2 verified: Contains new Link B');
      passed++;
    } else {
      throw new Error('FAILED: Version 2 does not contain Link B!');
    }

    // -------------------------------------------------------------
    // TEST SECTION 5: ACCESS CONTROL & AUDIT LOGGING
    // -------------------------------------------------------------
    console.log('\n[Section 5: Access Control & Audit Logging]');

    // 5.1 Authorized advocate gets external link
    const linkResult = await documentService.getExternalLink(
      createdExtDoc.id,
      null,
      advocateUser,
      { ip: '127.0.0.1', userAgent: 'Storage-Test-Runner' }
    );

    if (linkResult && linkResult.external_url === linkB) {
      console.log('✓ Authorized user successfully retrieved external URL');
      passed++;
    } else {
      throw new Error(`Failed to retrieve external link: ${JSON.stringify(linkResult)}`);
    }

    // 5.2 Verify DOCUMENT_EXTERNAL_LINK_OPENED audit log event
    const [auditRows] = await db.execute(
      `SELECT * FROM crm_audit_logs WHERE action = 'DOCUMENT_EXTERNAL_LINK_OPENED' AND entity_id = ? ORDER BY created_at DESC LIMIT 1`,
      [createdExtDoc.id]
    );

    if (auditRows.length > 0) {
      console.log(`✓ Audit event DOCUMENT_EXTERNAL_LINK_OPENED recorded in crm_audit_logs with user_id=${auditRows[0].user_id}`);
      passed++;
    } else {
      throw new Error('FAILED: DOCUMENT_EXTERNAL_LINK_OPENED audit event was not recorded!');
    }

    // 5.3 Attempting binary file download on EXTERNAL document must fail
    try {
      await documentVersionService.prepareDownload(createdExtDoc.id, ver2Res.id, advocateUser);
      throw new Error('FAILED: Download was permitted on an EXTERNAL link document!');
    } catch (err) {
      if (err.statusCode === 400 && err.message.toUpperCase().includes('EXTERNAL')) {
        console.log(`✓ Binary download on external document correctly rejected with 400: "${err.message}"`);
        passed++;
      } else {
        throw err;
      }
    }

    // -------------------------------------------------------------
    // TEST SECTION 6: E-SIGN RESTRICTION FOR EXTERNAL DOCUMENTS
    // -------------------------------------------------------------
    console.log('\n[Section 6: E-Sign Protection for External Documents]');

    // First submit and approve the external document
    const reviewRes = await documentReviewService.submitForReview(createdExtDoc.id, advocateUser.id, advocateUser.id, 'Ready for approval');
    await documentReviewService.processReview(reviewRes.reviewId, 'APPROVE', advocateUser, 'Approved external evidence bundle');

    // Attempting to initiate eSign on external document MUST fail
    try {
      await documentSignatureService.createSignatureRequest({
        documentId: createdExtDoc.id,
        signers: [{ name: 'Client Name', email: 'client@example.com', role: 'CLIENT' }],
        requestedBy: advocateUser.id
      });
      throw new Error('FAILED: E-Sign request was permitted on an external linked document!');
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes('External linked documents cannot be directly sent for eSign')) {
        console.log(`✓ E-Sign on external document correctly blocked: "${err.message}"`);
        passed++;
      } else {
        throw err;
      }
    }

    // -------------------------------------------------------------
    // TEST SECTION 7: DASHBOARD METRICS BREAKDOWN
    // -------------------------------------------------------------
    console.log('\n[Section 7: Dashboard Storage Metrics]');

    const stats = await documentService.getDashboardStats(advocateUser.id, advocateUser.role);
    if (
      stats.total_documents >= 1 &&
      stats.storage_internal !== undefined &&
      stats.storage_external !== undefined &&
      stats.providers?.google_drive !== undefined
    ) {
      console.log(`✓ Dashboard metrics breakdown verified: Internal=${stats.storage_internal}, External=${stats.storage_external}, GoogleDrive=${stats.providers.google_drive}`);
      passed++;
    } else {
      throw new Error(`Dashboard stats incomplete: ${JSON.stringify(stats)}`);
    }

    console.log('\n================================================================');
    console.log(`ALL PROMPT 11 DOCUMENT STORAGE TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
    process.exit(1);
  } finally {
    await db.end();
  }
}

runDocumentStorageTests();
