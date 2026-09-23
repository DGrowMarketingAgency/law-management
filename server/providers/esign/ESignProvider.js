/**
 * ESignProvider (Abstract Base Class)
 * Defines the contract that all external licensed legal e-signature providers must satisfy.
 * Real legal signature mechanisms (Aadhaar eSign, DSC, etc.) are implemented by licensed ASP/ESP providers (e.g. Digio, Leegality).
 */
class ESignProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Create an e-signature request with the external provider.
   *
   * @param {Object} params
   * @param {string|number} params.documentId
   * @param {number} params.versionNumber
   * @param {string} params.fileName
   * @param {Buffer} params.fileBuffer
   * @param {Array<Object>} params.signers - [{ name, email, phone, role, signingOrder }]
   * @param {string} params.signingOrder - 'SEQUENTIAL' | 'PARALLEL'
   * @param {number} params.expiryDays
   * @param {string} params.callbackUrl
   * @returns {Promise<{ providerRequestId: string, status: string, signers: Array<Object>, metadata: Object }>}
   */
  async createSignatureRequest(params) {
    throw new Error(`createSignatureRequest() not implemented by provider '${this.name}'`);
  }

  /**
   * Retrieve current signature request status from external provider.
   *
   * @param {string} providerRequestId
   * @returns {Promise<{ status: string, signers: Array<Object>, signedAt: Date|null, metadata: Object }>}
   */
  async getSignatureStatus(providerRequestId) {
    throw new Error(`getSignatureStatus() not implemented by provider '${this.name}'`);
  }

  /**
   * Cancel an active signature request.
   *
   * @param {string} providerRequestId
   * @param {string} reason
   * @returns {Promise<{ success: boolean, status: string }>}
   */
  async cancelSignatureRequest(providerRequestId, reason) {
    throw new Error(`cancelSignatureRequest() not implemented by provider '${this.name}'`);
  }

  /**
   * Download final signed PDF artifact from provider.
   *
   * @param {string} providerRequestId
   * @returns {Promise<{ buffer: Buffer, mimeType: string, fileName: string }>}
   */
  async downloadSignedDocument(providerRequestId) {
    throw new Error(`downloadSignedDocument() not implemented by provider '${this.name}'`);
  }

  /**
   * Verify authenticity and integrity of incoming webhook notification.
   *
   * @param {Object|string} payload
   * @param {string} signature
   * @param {Object} headers
   * @returns {boolean}
   */
  verifyWebhook(payload, signature, headers) {
    throw new Error(`verifyWebhook() not implemented by provider '${this.name}'`);
  }

  /**
   * Normalize incoming webhook payload into platform-standard event.
   *
   * @param {Object} payload
   * @param {Object} headers
   * @returns {{ eventType: string, providerRequestId: string, signerEmail: string|null, status: string, signedAt: Date|null }}
   */
  handleWebhook(payload, headers) {
    throw new Error(`handleWebhook() not implemented by provider '${this.name}'`);
  }
}

module.exports = ESignProvider;
