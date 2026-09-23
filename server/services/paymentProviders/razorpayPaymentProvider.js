const crypto = require("crypto");
const BasePaymentProvider = require("./basePaymentProvider");

class RazorpayPaymentProvider extends BasePaymentProvider {
  constructor() {
    super("RAZORPAY");
    this.keyId = process.env.RAZORPAY_KEY_ID || "";
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    this.mode = (process.env.RAZORPAY_MODE || "TEST").toUpperCase();
  }

  isConfigured() {
    return Boolean(this.keyId && this.keySecret && this.keyId !== "replace_this_later");
  }

  /**
   * Helper for authenticated HTTP requests to Razorpay API
   */
  async _apiRequest(endpoint, method = "GET", data = null) {
    const authHeader = "Basic " + Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    const options = {
      method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    };
    if (data && method !== "GET") {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`https://api.razorpay.com/v1${endpoint}`, options);
    const body = await response.json();
    if (!response.ok) {
      const err = new Error(body.error?.description || body.message || "Razorpay API error");
      err.code = body.error?.code || "RAZORPAY_ERROR";
      err.statusCode = response.status;
      err.details = body;
      throw err;
    }
    return body;
  }

  /**
   * Create an Order for checkout
   */
  async createOrder({ invoice, amount, currency = "INR", customer }) {
    const amountInPaise = Math.round(Number(amount) * 100);
    const receipt = `inv_${invoice.id}_${Date.now()}`.slice(0, 40);

    if (!this.isConfigured()) {
      const err = new Error("Razorpay credentials are not configured in environment (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
      err.code = "GATEWAY_NOT_CONFIGURED";
      err.statusCode = 503;
      throw err;
    }

    const order = await this._apiRequest("/orders", "POST", {
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        invoice_id: String(invoice.id),
        invoice_number: invoice.invoice_number,
        client_id: String(invoice.client_id),
      },
    });

    return {
      provider: "RAZORPAY",
      provider_order_id: order.id,
      amount: Number(amount),
      currency,
      key_id: this.keyId,
      receipt,
      status: "CREATED",
      raw: order,
    };
  }

  /**
   * Verify checkout callback signature
   * signature = HMAC_SHA256(order_id + "|" + payment_id, secret)
   */
  async verifyPayment({ orderId, paymentId, signature, secret = null }) {
    const signingSecret = secret || this.keySecret;
    if (!signingSecret) {
      return { verified: false, reason: "Razorpay secret key not configured." };
    }

    if (!orderId || !paymentId || !signature) {
      return { verified: false, reason: "Missing order_id, payment_id, or signature" };
    }

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", signingSecret)
      .update(payload)
      .digest("hex");

    let isMatch = false;
    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(signature, "utf-8"),
        Buffer.from(expectedSignature, "utf-8")
      );
    } catch {
      isMatch = false;
    }

    return {
      verified: isMatch,
      provider: "RAZORPAY",
      provider_order_id: orderId,
      provider_payment_id: paymentId,
      reason: isMatch ? null : "Invalid Razorpay HMAC signature",
    };
  }

  /**
   * Create Razorpay Payment Link
   */
  async createPaymentLink({ invoice, amount, description, expiryDate, allowPartial = false, customer }) {
    const amountInPaise = Math.round(Number(amount) * 100);

    if (this.isConfigured() && !this.keyId.startsWith("rzp_test_mock")) {
      try {
        const body = {
          amount: amountInPaise,
          currency: "INR",
          accept_partial: allowPartial,
          description: description || `Legal Services Invoice ${invoice.invoice_number}`,
          customer: {
            name: customer?.name || invoice.billing_name || "Client",
            email: customer?.email || invoice.billing_email || undefined,
            contact: customer?.phone || invoice.billing_phone || undefined,
          },
          notify: { sms: false, email: false }, // Use internal notification engine
          reminder_enable: false,
          notes: {
            invoice_id: String(invoice.id),
            invoice_number: invoice.invoice_number,
          },
        };

        if (expiryDate) {
          body.expire_by = Math.floor(new Date(expiryDate).getTime() / 1000);
        }

        const link = await this._apiRequest("/payment_links", "POST", body);
        return {
          provider: "RAZORPAY",
          provider_payment_link_id: link.id,
          payment_link_url: link.short_url,
          amount: Number(amount),
          status: link.status ? link.status.toUpperCase() : "ACTIVE",
          expires_at: expiryDate || null,
          raw: link,
        };
      } catch (err) {
        throw err;
      }
    }

    const err = new Error("Razorpay credentials are not configured in environment.");
    err.code = "GATEWAY_NOT_CONFIGURED";
    err.statusCode = 503;
    throw err;
  }

  /**
   * Process refund via Razorpay API
   */
  async refundPayment({ payment, amount, reason }) {
    const amountInPaise = Math.round(Number(amount) * 100);

    if (!this.isConfigured()) {
      const err = new Error("Razorpay credentials are not configured in environment.");
      err.code = "GATEWAY_NOT_CONFIGURED";
      err.statusCode = 503;
      throw err;
    }

    if (!payment.provider_payment_id) {
      throw new Error("Cannot process refund: missing payment provider transaction ID.");
    }

    const refund = await this._apiRequest(`/payments/${payment.provider_payment_id}/refund`, "POST", {
      amount: amountInPaise,
      notes: {
        reason: reason || "Chambers legal fee refund",
        payment_id: String(payment.id),
      },
    });

    return {
      provider: "RAZORPAY",
      provider_refund_id: refund.id,
      amount: Number(amount),
      status: "SUCCESS",
      raw: refund,
    };
  }

  /**
   * Verify Webhook raw body signature (X-Razorpay-Signature)
   */
  verifyWebhook({ rawBody, headers, secret = null }) {
    const webhookSecret = secret || this.webhookSecret;
    if (!webhookSecret) {
      return false;
    }
    const signature = headers?.["x-razorpay-signature"] || headers?.["X-Razorpay-Signature"];

    if (!rawBody || !signature) {
      return false;
    }

    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf-8");
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyBuffer)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, "utf-8"),
        Buffer.from(expectedSignature, "utf-8")
      );
    } catch {
      return false;
    }
  }

  /**
   * Map standard Razorpay webhook events to application state
   */
  handleWebhook(payload) {
    const event = payload?.event || "";
    const eventId = payload?.entity?.id || payload?.id || null;

    let orderId = null;
    let paymentId = null;
    let amount = 0;
    let status = "PENDING";
    let invoiceId = null;

    if (event.startsWith("payment.")) {
      const paymentEntity = payload.payload?.payment?.entity || {};
      paymentId = paymentEntity.id;
      orderId = paymentEntity.order_id;
      amount = (paymentEntity.amount || 0) / 100;
      invoiceId = paymentEntity.notes?.invoice_id ? parseInt(paymentEntity.notes.invoice_id, 10) : null;

      if (event === "payment.captured" || event === "payment.authorized") {
        status = "SUCCESS";
      } else if (event === "payment.failed") {
        status = "FAILED";
      }
    } else if (event.startsWith("payment_link.")) {
      const linkEntity = payload.payload?.payment_link?.entity || {};
      paymentId = payload.payload?.payment?.entity?.id || null;
      amount = (linkEntity.amount_paid || linkEntity.amount || 0) / 100;
      invoiceId = linkEntity.notes?.invoice_id ? parseInt(linkEntity.notes.invoice_id, 10) : null;

      if (event === "payment_link.paid") {
        status = "SUCCESS";
      } else if (event === "payment_link.expired") {
        status = "EXPIRED";
      } else if (event === "payment_link.cancelled") {
        status = "CANCELLED";
      }
    } else if (event === "order.paid") {
      const orderEntity = payload.payload?.order?.entity || {};
      orderId = orderEntity.id;
      amount = (orderEntity.amount_paid || orderEntity.amount || 0) / 100;
      invoiceId = orderEntity.notes?.invoice_id ? parseInt(orderEntity.notes.invoice_id, 10) : null;
      status = "SUCCESS";
    }

    return {
      provider: "RAZORPAY",
      eventType: event,
      eventId,
      orderId,
      paymentId,
      amount,
      status,
      invoiceId,
      raw: payload,
    };
  }
}

module.exports = RazorpayPaymentProvider;
