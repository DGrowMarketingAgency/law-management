/**
 * Automated Test Suite: E-Signature Integration & Multi-Signer Workflows
 * Tests:
 * 1. Block signature requests for unapproved drafts (fails closed)
 * 2. Initiate signature request with Mock provider and multiple signers
 * 3. Verify signers tracking and sequential/parallel signing URLs
 * 4. Process mock webhook simulation event (signing completed)
 * 5. Verify immutable signed version bump (v1 -> v2) and document status transition to SIGNED
 * 6. Verify signed document download buffer
 */

const db = require('../config/database');
const documentService = require('../services/documentService');
const documentTemplateService = require('../services/documentTemplateService');
const documentReviewService = require('../services/documentReviewService');
const documentSignatureService = require('../services/documentSignatureService');
const { getESignProvider } = require('../providers/esign/esignProviderFactory');

async function runESignTests() {
  console.log('--- STARTING E-SIGNATURE INTEGRATION TESTS ---');
  let passed = 0;
  let failed = 0;

  const advocateUser = { id: 1, role: 'ADVOCATE', first_name: 'Lead', last_name: 'Counsel' };

  try {
    // 1. Create a draft document
    console.log('\n[Test 1] Creating test document for signature workflow...');
    const templates = await documentTemplateService.getTemplates();
    const vakalatnama = templates.find(t => t.code === 'TMPL_VAKALATNAMA') || templates[0];

    const draftDoc = await documentService.createFromTemplate({
      templateId: vakalatnama.id,
      title: 'Vakalatnama - E-Sign Execution Test',
      variables: {
        CLIENT_NAME: 'Ananya Deshmukh',
        CLIENT_ADDRESS: 'Bandra West, Mumbai',
        COURT_NAME: 'City Civil Court, Dindoshi',
        CASE_TITLE: 'Deshmukh vs Global Retail Ltd',
        ADVOCATE_NAME: 'Adv. Rajesh Narayanan'
      },
      user: advocateUser,
      reqInfo: { ip: '127.0.0.1', userAgent: 'Jest-Test-Runner' }
    });

    console.log(`✓ Draft document created (ID: ${draftDoc.id}, Status: ${draftDoc.status})`);
    passed++;

    // 2. Verify unapproved document CANNOT be sent for e-signature
    console.log('\n[Test 2] Testing unapproved document protection (must FAIL closed)...');
    try {
      await documentSignatureService.createSignatureRequest({
        documentId: draftDoc.id,
        signers: [{ name: 'Ananya Deshmukh', email: 'ananya@example.com', role: 'CLIENT' }],
        requestedBy: advocateUser.id
      });
      throw new Error('FAILED: Unapproved draft was allowed into e-signature workflow!');
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes('APPROVED')) {
        console.log(`✓ Unapproved document correctly rejected: "${err.message}"`);
        passed++;
      } else {
        throw err;
      }
    }

    // 3. Approve document first
    console.log('\n[Test 3] Approving document as Advocate...');
    await documentReviewService.approveDocument(draftDoc.id, advocateUser.id, advocateUser.role, 'Verified and approved for client eSign.');
    console.log(`✓ Document approved successfully.`);
    passed++;

    // 4. Create Signature Request with Mock Provider (Sequential Order)
    console.log('\n[Test 4] Initiating e-signature request with Mock provider...');
    const signers = [
      { name: 'Ananya Deshmukh', email: 'ananya@example.com', phone: '+919876543210', role: 'CLIENT', signingOrder: 1 },
      { name: 'Adv. Rajesh Narayanan', email: 'rajesh@chamber.law', phone: '+919876543211', role: 'ADVOCATE', signingOrder: 2 }
    ];

    const sigRequest = await documentSignatureService.createSignatureRequest({
      documentId: draftDoc.id,
      signers,
      signingOrder: 'SEQUENTIAL',
      providerName: 'MOCK',
      requestedBy: advocateUser.id
    });

    if (sigRequest && sigRequest.requestCode && sigRequest.signers.length === 2) {
      console.log(`✓ Created signature request ${sigRequest.requestCode} with ${sigRequest.signers.length} signers.`);
      passed++;
    } else {
      throw new Error('Failed to create valid signature request.');
    }

    // 5. Simulate Provider Webhook Event (Mock Completion)
    console.log('\n[Test 5] Simulating eSign completion webhook event...');
    const mockProvider = getESignProvider('MOCK');
    
    // Construct mock completion payload
    const webhookPayload = {
      event: 'DOCUMENT_SIGNED',
      payload: {
        document: {
          id: sigRequest.providerRequestId,
          agreement_status: 'completed'
        },
        signer: {
          identifier: 'ananya@example.com'
        }
      }
    };

    const webhookResult = await documentSignatureService.handleWebhook('MOCK', webhookPayload, 'test-valid', {
      'x-mock-signature': 'valid'
    });

    if (webhookResult && webhookResult.success) {
      console.log(`✓ Webhook handled successfully. Result:`, webhookResult);
      passed++;
    } else {
      throw new Error('Webhook processing failed.');
    }

    // 6. Verify Document Status updated to SIGNED and Version Bumped
    console.log('\n[Test 6] Verifying document status transition and version bump...');
    const [docRows] = await db.query(`SELECT d.*, dv.version_number, dv.checksum FROM documents d JOIN document_versions dv ON d.current_version_id = dv.id WHERE d.id = ?`, [draftDoc.id]);
    const updatedDoc = docRows[0];

    if (updatedDoc.status === 'SIGNED' && updatedDoc.version_number === 2) {
      console.log(`✓ Document transitioned to SIGNED status.`);
      console.log(`✓ Immutable signed version created: v${updatedDoc.version_number} (Checksum: ${updatedDoc.checksum.slice(0, 24)}...)`);
      passed++;
    } else {
      throw new Error(`Expected status SIGNED and version 2, got status ${updatedDoc.status} and version ${updatedDoc.version_number}`);
    }

    // 7. Verify Signed Document Download
    console.log('\n[Test 7] Testing signed document artifact download...');
    const download = await documentSignatureService.downloadSignedDocument(sigRequest.signatureRequestId);
    if (download && download.buffer && download.buffer.length > 0) {
      console.log(`✓ Successfully retrieved signed PDF buffer (${download.buffer.length} bytes, file: ${download.filename})`);
      passed++;
    } else {
      throw new Error('Signed document download buffer is empty.');
    }

    console.log(`\n========================================`);
    console.log(`E-SIGN TESTS: ALL ${passed} PASSED!`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error(`\n❌ Test failed:`, err.stack || err.message);
    failed++;
  } finally {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runESignTests();
