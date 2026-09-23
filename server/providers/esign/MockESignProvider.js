const crypto = require('crypto');
const { generateLegalDocumentPdf } = require('../../utils/legalPdfGenerator');
const ESignProvider = require('./ESignProvider');

/**
 * MockESignProvider
 * Deterministic e-signature provider for local development, testing, and offline demos.
 * Implements the full ESign contract, generates valid signed PDF artifacts, and supports webhook simulation.
 */
class MockESignProvider extends ESignProvider {
  constructor(config = {}) {
    super('MOCK');
    this.webhookSecret = config.webhookSecret || process.env.MOCK_ESIGN_WEBHOOK_SECRET || 'mock_esign_secret_key_123';
    // In-memory simulation registry for mock requests
    this.requests = new Map();
  }

  isConfigured() {
    return true;
  }

  async createSignatureRequest({ documentId, versionNumber, fileName, fileBuffer, signers, signingOrder, expiryDays = 7, callbackUrl }) {
    const providerRequestId = `mock_sig_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    const enrichedSigners = signers.map((s, idx) => ({
      name: s.name,
      email: s.email,
      phone: s.phone || null,
      role: s.role || 'CLIENT',
      signingOrder: signingOrder === 'SEQUENTIAL' ? (s.signingOrder || idx + 1) : 1,
      status: 'SENT',
      signatureUrl: `http://localhost:5173/sign/mock/${providerRequestId}?signer=${encodeURIComponent(s.email)}`,
      signedAt: null
    }));

    const mockRecord = {
      providerRequestId,
      documentId,
      versionNumber,
      fileName,
      status: 'SENT',
      signers: enrichedSigners,
      signingOrder,
      expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      fileBuffer
    };

    this.requests.set(providerRequestId, mockRecord);

    return {
      providerRequestId,
      status: 'SENT',
      signers: enrichedSigners,
      metadata: { mockProvider: true, simulator: 'active', signCount: signers.length }
    };
  }

  async getSignatureStatus(providerRequestId) {
    const record = this.requests.get(providerRequestId);
    if (!record) {
      // Return default completed record if querying unknown id in tests
      return {
        status: 'SIGNED',
        signers: [],
        signedAt: new Date(),
        metadata: { mockFallback: true }
      };
    }

    return {
      status: record.status,
      signers: record.signers,
      signedAt: record.signedAt || null,
      metadata: { mockProvider: true }
    };
  }

  async cancelSignatureRequest(providerRequestId, reason = 'Cancelled by advocate') {
    const record = this.requests.get(providerRequestId);
    if (record) {
      record.status = 'CANCELLED';
      record.cancelledAt = new Date();
      record.cancelReason = reason;
    }
    return { success: true, status: 'CANCELLED' };
  }

  /**
   * Generates a valid signed PDF buffer stamped with digital audit signatures
   */
  async downloadSignedDocument(providerRequestId) {
    const record = this.requests.get(providerRequestId) || {
      fileName: 'document.pdf',
      signers: [{ name: 'Test Signer', email: 'signer@example.com' }]
    };

    const signersList = record.signers || [{ name: 'Authorized Signatory', email: 'client@example.com' }];
    const signersText = signersList.map((s, idx) => `${idx + 1}. Signed by: ${s.name || s.signerName} (${s.email || s.signerEmail}) - Digital Seal Verified`).join('\n');

    const pdfBuffer = generateLegalDocumentPdf({
      title: 'CERTIFICATE OF ELECTRONIC SIGNATURE & AUDIT TRAIL',
      documentNumber: providerRequestId,
      content: `DOCUMENT SIGNATURE COMPLETION RECORD\n\nProvider Reference ID: ${providerRequestId}\nTimestamp: ${new Date().toISOString()}\nAudit Status: LEGALLY SIGNED & VERIFIED\n\nELECTRONIC SIGNATURE VERIFICATIONS:\n${signersText}\n\nThis electronic document has been authenticated under Section 65B of the Indian Evidence Act / IT Act 2000.`,
      signers: signersList,
      signatureCertificate: {
        provider: 'MOCK_LEGAL_ESIGN',
        auditTrailId: providerRequestId,
        signedChecksum: crypto.createHash('sha256').update(providerRequestId).digest('hex'),
        timestamp: new Date().toISOString()
      }
    });

    return {
      buffer: pdfBuffer,
      mimeType: 'application/pdf',
      fileName: `Signed_${record.fileName || providerRequestId}.pdf`
    };
  }

  verifyWebhook(payload, signature, headers = {}) {
    if (!signature || signature === 'test-valid' || headers?.['x-mock-signature'] === 'valid') {
      return true;
    }
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return signature === expected || signature === 'mock-valid-signature';
  }

  handleWebhook(payload) {
    const providerRequestId = payload.providerRequestId || payload.id || payload.payload?.document?.id;
    const status = payload.status || (payload.payload?.document?.agreement_status === 'completed' ? 'SIGNED' : 'SIGNED');
    const signerEmail = payload.signerEmail || payload.payload?.signer?.identifier || null;

    const record = this.requests.get(providerRequestId);
    if (record) {
      record.status = status;
      if (status === 'SIGNED') {
        record.signedAt = new Date();
      }
      if (signerEmail) {
        const targetSigner = record.signers.find(s => s.email === signerEmail);
        if (targetSigner) {
          targetSigner.status = status;
          targetSigner.signedAt = new Date();
        }
      }
    }

    return {
      eventType: payload.eventType || 'DOCUMENT_SIGNED',
      providerRequestId,
      signerEmail,
      status,
      signedAt: new Date()
    };
  }
}

module.exports = MockESignProvider;
