const crypto = require('crypto');
const ESignProvider = require('./ESignProvider');

/**
 * LeegalityProvider
 * Implements Leegality API integration (licensed ASP / eSign provider in India).
 * Uses native Node.js fetch.
 */
class LeegalityProvider extends ESignProvider {
  constructor(config = {}) {
    super('LEEGALITY');
    this.baseUrl = config.baseUrl || process.env.LEEGALITY_BASE_URL || 'https://sandbox.leegality.com/api/v2.1';
    this.authKey = config.authKey || process.env.LEEGALITY_CLIENT_SECRET || '';
    this.webhookSecret = config.webhookSecret || process.env.LEEGALITY_WEBHOOK_SECRET || '';
  }

  getHeaders() {
    return {
      'X-Auth-Token': this.authKey,
      'Content-Type': 'application/json'
    };
  }

  isConfigured() {
    return !!this.authKey;
  }

  async createSignatureRequest({ documentId, fileName, fileBuffer, signers, signingOrder, expiryDays = 10, callbackUrl }) {
    if (!this.isConfigured()) {
      throw new Error('Leegality provider credentials (LEEGALITY_CLIENT_SECRET) not configured.');
    }

    const payload = {
      profileId: process.env.LEEGALITY_PROFILE_ID || 'DEFAULT',
      file: {
        name: fileName || `Document_${documentId}.pdf`,
        file: fileBuffer ? fileBuffer.toString('base64') : ''
      },
      invitees: signers.map((s, idx) => ({
        name: s.name,
        email: s.email,
        phone: s.phone,
        active: true,
        order: signingOrder === 'SEQUENTIAL' ? (s.signingOrder || idx + 1) : 1
      })),
      expiryDays
    };

    const response = await fetch(`${this.baseUrl}/document/create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Leegality create document failed (${response.status}): ${errText}`);
    }

    const json = await response.json();
    const data = json.data || {};
    return {
      providerRequestId: data.documentId || data.id,
      status: 'SENT',
      signers: (data.invitees || []).map(inv => ({
        email: inv.email,
        status: inv.signed ? 'SIGNED' : 'SENT',
        signatureUrl: inv.signUrl || null
      })),
      metadata: { leegalityDocId: data.documentId }
    };
  }

  async getSignatureStatus(providerRequestId) {
    if (!this.isConfigured()) {
      throw new Error('Leegality provider credentials not configured.');
    }

    const response = await fetch(`${this.baseUrl}/document/details?documentId=${providerRequestId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Leegality get details failed (${response.status}): ${errText}`);
    }

    const json = await response.json();
    const data = json.data || {};
    let status = 'SENT';
    if (data.status === 'COMPLETED') status = 'SIGNED';
    else if (data.status === 'EXPIRED') status = 'EXPIRED';
    else if (data.status === 'REJECTED') status = 'DECLINED';

    return {
      status,
      signers: (data.invitees || []).map(inv => ({
        email: inv.email,
        status: inv.signed ? 'SIGNED' : inv.rejected ? 'DECLINED' : 'SENT',
        signedAt: inv.signedDate ? new Date(inv.signedDate) : null
      })),
      signedAt: data.status === 'COMPLETED' ? new Date() : null,
      metadata: data
    };
  }

  async cancelSignatureRequest(providerRequestId, reason = 'Cancelled by advocate') {
    if (!this.isConfigured()) {
      throw new Error('Leegality provider credentials not configured.');
    }

    const response = await fetch(`${this.baseUrl}/document/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ documentId: providerRequestId, reason })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Leegality cancel failed (${response.status}): ${errText}`);
    }

    return { success: true, status: 'CANCELLED' };
  }

  async downloadSignedDocument(providerRequestId) {
    if (!this.isConfigured()) {
      throw new Error('Leegality provider credentials not configured.');
    }

    const response = await fetch(`${this.baseUrl}/document/download?documentId=${providerRequestId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Leegality download failed (${response.status}): ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: 'application/pdf',
      fileName: `Signed_${providerRequestId}.pdf`
    };
  }

  verifyWebhook(payload, signature, headers = {}) {
    if (!this.webhookSecret) return false;
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  handleWebhook(payload) {
    const data = payload.data || payload;
    let status = 'SENT';
    if (data.status === 'COMPLETED') status = 'SIGNED';
    else if (data.status === 'REJECTED') status = 'DECLINED';
    else if (data.status === 'EXPIRED') status = 'EXPIRED';

    return {
      eventType: payload.event || 'DOCUMENT_COMPLETED',
      providerRequestId: data.documentId,
      signerEmail: data.inviteeEmail || null,
      status,
      signedAt: data.status === 'COMPLETED' ? new Date() : null
    };
  }
}

module.exports = LeegalityProvider;
