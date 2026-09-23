/**
 * Base Payment Provider Interface
 * Abstract foundation for gateway and manual payment implementations.
 */
class BasePaymentProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Create an online payment order
   * @param {object} params
   * @returns {Promise<object>}
   */
  async createOrder(params) {
    const err = new Error(`Order creation not supported by ${this.name}`);
    err.code = "FEATURE_NOT_SUPPORTED";
    throw err;
  }

  /**
   * Verify an online payment callback/response
   * @param {object} params
   * @returns {Promise<object>}
   */
  async verifyPayment(params) {
    const err = new Error(`Payment verification not supported by ${this.name}`);
    err.code = "FEATURE_NOT_SUPPORTED";
    throw err;
  }

  /**
   * Generate an online payment link
   * @param {object} params
   * @returns {Promise<object>}
   */
  async createPaymentLink(params) {
    const err = new Error(`Payment links not supported by ${this.name}`);
    err.code = "FEATURE_NOT_SUPPORTED";
    throw err;
  }

  /**
   * Query status from provider
   * @param {string} providerPaymentId
   * @param {string} [providerOrderId]
   * @returns {Promise<object>}
   */
  async getPaymentStatus(providerPaymentId, providerOrderId) {
    const err = new Error(`Status inquiry not supported by ${this.name}`);
    err.code = "FEATURE_NOT_SUPPORTED";
    throw err;
  }

  /**
   * Process refund through provider
   * @param {object} params
   * @returns {Promise<object>}
   */
  async refundPayment(params) {
    const err = new Error(`Refunds not supported by ${this.name}`);
    err.code = "FEATURE_NOT_SUPPORTED";
    throw err;
  }

  /**
   * Verify webhook authenticity
   * @param {object} params { rawBody, headers, payload }
   * @returns {boolean}
   */
  verifyWebhook(params) {
    const err = new Error(`Webhook verification not supported by ${this.name}`);
    err.code = "FEATURE_NOT_SUPPORTED";
    throw err;
  }

  /**
   * Map provider webhook payload into normalized event
   * @param {object} payload
   * @returns {object} { eventType, eventId, orderId, paymentId, amount, status, raw }
   */
  handleWebhook(payload) {
    const err = new Error(`Webhook handling not supported by ${this.name}`);
    err.code = "FEATURE_NOT_SUPPORTED";
    throw err;
  }
}

module.exports = BasePaymentProvider;
