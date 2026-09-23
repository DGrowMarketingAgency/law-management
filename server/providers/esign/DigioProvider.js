const crypto = require('crypto');
const ESignProvider = require('./ESignProvider');

/**
 * DigioProvider
 * Implements Digio E-Sign API integration (licensed ASP for Aadhaar/DSC eSign in India).
 * Uses Digio v2 Document Signing APIs with Node.js native fetch.
 */
class DigioProvider extends ESignProvider {
  constructor(config = {}) {
    super('DIGIO');
    this.baseUrl = config.baseUrl || process.env.DIGIO_BASE_URL || 'https://ext.digio.in:444';
    this.clientId = config.clientId || process.env.DIGIO_CLIENT_ID || '';
    this.clientSecret = config.clientSecret || process.env.DIGIO_CLIENT_SECRET || '';
    this.webhookSecret = config.webhookSecret || process.env.DIGIO_WEBHOOK_SECRET || '';
  }

  getAuthHeaders() {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json'
    };
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  async createSignatureRequest({ documentId, fileName, fileBuffer, signers, signingOrder, expiryDays = 7, callbackUrl }) {
    if (!this.isConfigured()) {
      throw new Error('Digio provider credentials (CLIENT_ID / CLIENT_SECRET) not configured.');
    }

    const payload = {
      signers: signers.map((s, idx) => ({
        identifier: s.email || s.phone,
        name: s.name,
        sign_type: 'aadhaar',
        sequence: signingOrder === 'SEQUENTIAL' ? s.signingOrder || (idx + 1) : 1
      })),
      expire_in_days: expiryDays,
      display_on_page: 'all',
      notify_signers: true,
      file_name: fileName || `Document_${documentId}.pdf`
    };

    const response = await fetch(`${this.baseUrl}/v2/client/document/uploadjson`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Digio uploadjson failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return {
      providerRequestId: data.id,
      status: data.agreement_status === 'requested' ? 'REQUESTED' : 'SENT',
      signers: (data.signers || []).map(s => ({
        email: s.identifier,
        status: s.status === 'signed' ? 'SIGNED' : 'SENT',
        signatureUrl: s.signing_link || null
      })),
      metadata: { digioDocumentId: data.id, agreementType: data.agreement_type }
    };
  }

  async getSignatureStatus(providerRequestId) {
    if (!this.isConfigured()) {
      throw new Error('Digio provider credentials not configured.');
    }

    const response = await fetch(`${this.baseUrl}/v2/client/document/${providerRequestId}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Digio get document failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    let status = 'REQUESTED';
    if (data.agreement_status === 'completed') status = 'SIGNED';
    else if (data.agreement_status === 'expired') status = 'EXPIRED';
    else if (data.agreement_status === 'rejected') status = 'DECLINED';

    return {
      status,
      signers: (data.signers || []).map(s => ({
        email: s.identifier,
        status: s.status === 'signed' ? 'SIGNED' : s.status === 'rejected' ? 'DECLINED' : 'SENT',
        signedAt: s.signed_at ? new Date(s.signed_at) : null
      })),
      signedAt: data.agreement_status === 'completed' && data.updated_at ? new Date(data.updated_at) : null,
      metadata: data
    };
  }

  async cancelSignatureRequest(providerRequestId, reason = 'Cancelled by advocate') {
    if (!this.isConfigured()) {
      throw new Error('Digio provider credentials not configured.');
    }

    const response = await fetch(`${this.baseUrl}/v2/client/document/${providerRequestId}/cancel`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Digio cancel failed (${response.status}): ${errText}`);
    }

    return { success: true, status: 'CANCELLED' };
  }

  async downloadSignedDocument(providerRequestId) {
    if (!this.isConfigured()) {
      throw new Error('Digio provider credentials not configured.');
    }

    const response = await fetch(`${this.baseUrl}/v2/client/document/download?document_id=${providerRequestId}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Digio download failed (${response.status}): ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: 'application/pdf',
      fileName: `Signed_${providerRequestId}.pdf`
    };
  }

  verifyWebhook(payload, signature, headers = {}) {
    if (!this.webhookSecret) {
      return false;
    }
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  handleWebhook(payload) {
    const doc = payload.payload?.document || payload;
    let status = 'REQUESTED';
    if (doc.agreement_status === 'completed') status = 'SIGNED';
    else if (doc.agreement_status === 'rejected') status = 'DECLINED';
    else if (doc.agreement_status === 'expired') status = 'EXPIRED';

    return {
      eventType: payload.event || 'DOCUMENT_STATUS_UPDATE',
      providerRequestId: doc.id,
      signerEmail: payload.payload?.signer?.identifier || null,
      status,
      signedAt: doc.agreement_status === 'completed' ? new Date() : null
    };
  }
}

module.exports = DigioProvider;
