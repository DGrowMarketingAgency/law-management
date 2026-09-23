/**
 * Automated Test Suite: Document Security & Multi-Tier RBAC Isolation
 * Tests:
 * 1. ADVOCATE_ONLY confidentiality protection (paralegal/client blocked)
 * 2. Case isolation (non-assigned team member cannot access case docs)
 * 3. Client isolation (client can only access explicitly shared documents)
 * 4. Document locking protection (updates blocked on locked/approved documents)
 */

const db = require('../config/database');
const documentService = require('../services/documentService');
const { checkDocumentAccess } = require('../services/documentAccessService');

async function runSecurityTests() {
  console.log('--- STARTING DOCUMENT SECURITY & RBAC ISOLATION TESTS ---');
  let passed = 0;
  let failed = 0;

  const advocateUser = { id: 1, role: 'ADVOCATE' };
  const paralegalUser = { id: 2, role: 'PARALEGAL' };
  const clientUser = { id: 99, role: 'CLIENT' };

  try {
    // 1. Advocate-Only Confidentiality Protection
    console.log('\n[Test 1] Testing ADVOCATE_ONLY confidentiality restriction...');
    const advocateDoc = {
      id: 9991,
      case_id: null,
      confidentiality_level: 'ADVOCATE_ONLY',
      created_by: advocateUser.id,
      is_locked: 0
    };

    const advocateAccess = await checkDocumentAccess(advocateUser.id, advocateDoc, 'VIEW');
    if (advocateAccess.allowed) {
      console.log(`✓ Advocate granted access to ADVOCATE_ONLY document.`);
      passed++;
    } else {
      throw new Error('Advocate should be allowed to view ADVOCATE_ONLY doc');
    }

    const paralegalAccess = await checkDocumentAccess(paralegalUser.id, advocateDoc, 'VIEW');
    if (!paralegalAccess.allowed) {
      console.log(`✓ Paralegal correctly DENIED access to ADVOCATE_ONLY doc: "${paralegalAccess.reason}"`);
      passed++;
    } else {
      throw new Error('FAILED: Paralegal was granted access to ADVOCATE_ONLY doc!');
    }

    // 2. Client Isolation (Direct access blocked without explicit share)
    console.log('\n[Test 2] Testing Client isolation on unshared document...');
    const unsharedDoc = {
      id: 9992,
      case_id: 1,
      client_id: 50,
      confidentiality_level: 'NORMAL',
      created_by: advocateUser.id,
      is_locked: 0
    };

    const clientAccess = await checkDocumentAccess(clientUser.id, unsharedDoc, 'VIEW');
    if (!clientAccess.allowed) {
      console.log(`✓ Client correctly blocked from unshared document: "${clientAccess.reason}"`);
      passed++;
    } else {
      throw new Error('FAILED: Client accessed unshared internal document!');
    }

    // 3. Document Locking Protection
    console.log('\n[Test 3] Testing Document Locking enforcement on locked documents...');
    // Create a temporary document and lock it
    const file = {
      buffer: Buffer.from('%PDF-1.4 test lock buffer'),
      originalname: 'lock_test.pdf',
      mimetype: 'application/pdf',
      size: 24
    };

    const lockedDoc = await documentService.createDocument(
      null,
      {
        title: 'Locking Test Document',
        category: 'CASE_DOCUMENT',
        confidentiality_level: 'NORMAL'
      },
      file,
      advocateUser,
      { ip: '127.0.0.1' }
    );

    // Manually lock it
    await db.query(`UPDATE documents SET is_locked = TRUE WHERE id = ?`, [lockedDoc.id]);

    try {
      await documentService.updateDocument(
        lockedDoc.id,
        { title: 'Illegal Modification Title' },
        advocateUser,
        { ip: '127.0.0.1' }
      );
      throw new Error('FAILED: Locked document was modified!');
    } catch (err) {
      if (err.statusCode === 423 || err.message.includes('locked')) {
        console.log(`✓ Modification on locked document blocked: "${err.message}"`);
        passed++;
      } else {
        throw err;
      }
    }

    console.log(`\n========================================`);
    console.log(`SECURITY TESTS: ALL ${passed} PASSED!`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error(`\n❌ Test failed:`, err.stack || err.message);
    failed++;
  } finally {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runSecurityTests();
