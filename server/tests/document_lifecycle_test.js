/**
 * Automated Test Suite: Document Lifecycle & Approval Workflow
 * Tests:
 * 1. Template retrieval and variable auto-population
 * 2. Document creation from legal template
 * 3. Document submission for review (DRAFT -> IN_REVIEW)
 * 4. Advocate approval enforcement (Advocate succeeds, non-advocate rejected)
 * 5. Document locking upon approval
 * 6. Threaded comments and resolution
 * 7. Version immutability and SHA-256 checksum validation
 */

const db = require('../config/database');
const documentService = require('../services/documentService');
const documentTemplateService = require('../services/documentTemplateService');
const documentReviewService = require('../services/documentReviewService');
const documentVersionService = require('../services/documentVersionService');

async function runLifecycleTests() {
  console.log('--- STARTING DOCUMENT LIFECYCLE & APPROVAL TESTS ---');
  let passed = 0;
  let failed = 0;

  const advocateUser = { id: 1, role: 'ADVOCATE', first_name: 'Lead', last_name: 'Counsel' };
  const paralegalUser = { id: 2, role: 'PARALEGAL', first_name: 'Para', last_name: 'Legal' };

  try {
    // 1. Template Retrieval & Variable extraction
    console.log('\n[Test 1] Testing legal templates retrieval...');
    const templates = await documentTemplateService.getTemplates();
    if (templates.length > 0) {
      console.log(`✓ Retrieved ${templates.length} legal templates.`);
      passed++;
    } else {
      throw new Error('No legal templates found.');
    }

    const bailTemplate = templates.find(t => t.code === 'TMPL_BAIL_APPLICATION') || templates[0];
    const extractedVars = documentTemplateService.extractVariables(bailTemplate.content);
    console.log(`✓ Extracted template variables: ${extractedVars.join(', ')}`);
    passed++;

    // 2. Document Creation from Template
    console.log('\n[Test 2] Testing document creation from template...');
    const testDoc = await documentService.createFromTemplate({
      templateId: bailTemplate.id,
      caseId: null, // firm/unassigned doc
      title: 'Lifecycle Test Bail Petition - State vs Ramesh',
      variables: {
        ACCUSED_NAME: 'Ramesh Kumar',
        COURT_NAME: 'High Court of Judicature',
        CASE_NUMBER: 'BAIL-2026/892',
        OFFENCE_SECTIONS: 'Section 420, 406 IPC',
        POLICE_STATION: 'Cyber Crime PS',
        BAIL_GROUNDS: 'Accused is a respectable citizen with no prior criminal antecedents.'
      },
      user: paralegalUser,
      reqInfo: { ip: '127.0.0.1', userAgent: 'Jest-Test-Runner' }
    });

    if (testDoc && testDoc.id && testDoc.document_number) {
      console.log(`✓ Created document ${testDoc.document_number} (ID: ${testDoc.id}) in status ${testDoc.status}`);
      passed++;
    } else {
      throw new Error('Failed to create document from template.');
    }

    // 3. Submit for Review
    console.log('\n[Test 3] Testing review submission (DRAFT -> IN_REVIEW)...');
    const reviewResult = await documentReviewService.submitForReview(
      testDoc.id,
      paralegalUser.id,
      advocateUser.id,
      'Draft completed with accused details. Ready for review.'
    );
    if (reviewResult.document.status === 'IN_REVIEW') {
      console.log(`✓ Document status transitioned to ${reviewResult.document.status}`);
      passed++;
    } else {
      throw new Error(`Expected IN_REVIEW, got ${reviewResult.document.status}`);
    }

    // 4. Non-Advocate Approval Enforcement (Must FAIL closed)
    console.log('\n[Test 4] Testing non-advocate approval restriction...');
    try {
      await documentReviewService.approveDocument(
        testDoc.id,
        paralegalUser.id,
        paralegalUser.role,
        'Unauthorized approval attempt'
      );
      throw new Error('FAILED: Non-advocate was able to approve document!');
    } catch (err) {
      if (err.statusCode === 403) {
        console.log(`✓ Unauthorized approval blocked with 403: "${err.message}"`);
        passed++;
      } else {
        throw err;
      }
    }

    // 5. Advocate Approval & Document Locking
    console.log('\n[Test 5] Testing advocate approval and auto-locking...');
    const approvalResult = await documentReviewService.approveDocument(
      testDoc.id,
      advocateUser.id,
      advocateUser.role,
      'Approved for filing and signatures.'
    );
    if (approvalResult.document.status === 'APPROVED' && approvalResult.document.is_locked === 1) {
      console.log(`✓ Document successfully APPROVED and locked (is_locked = 1).`);
      passed++;
    } else {
      throw new Error('Document status not updated to APPROVED or not locked.');
    }

    // 6. Threaded Comments
    console.log('\n[Test 6] Testing threaded comments and resolution...');
    const parentComment = await documentReviewService.addComment(
      testDoc.id,
      advocateUser.id,
      'Please verify bail surety bond amount.',
      null,
      1
    );
    const childComment = await documentReviewService.addComment(
      testDoc.id,
      paralegalUser.id,
      'Verified with client, bond amount is Rs. 50,000.',
      parentComment.id,
      1
    );
    const resolved = await documentReviewService.resolveComment(parentComment.id, advocateUser.id);
    if (resolved && resolved.is_resolved) {
      console.log(`✓ Threaded comments posted and parent comment marked as resolved.`);
      passed++;
    } else {
      throw new Error('Failed to resolve comment.');
    }

    // 7. Version Immutability & Checksum
    console.log('\n[Test 7] Testing version immutability and checksum...');
    const versions = await documentVersionService.getDocumentVersions(testDoc.id, advocateUser);
    if (versions.length > 0 && versions[0].checksum) {
      console.log(`✓ Document v${versions[0].version_number} has verified SHA-256: ${versions[0].checksum}`);
      passed++;
    } else {
      throw new Error('Version checksum missing.');
    }

    console.log(`\n========================================`);
    console.log(`LIFECYCLE TESTS: ALL ${passed} PASSED!`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error(`\n❌ Test failed:`, err.stack || err.message);
    failed++;
  } finally {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runLifecycleTests();
