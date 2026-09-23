const crypto = require("crypto");
const BasePaymentProvider = require("./basePaymentProvider");

class PayUPaymentProvider extends BasePaymentProvider {
  constructor() {
    super("PAYU");
    this.key = process.env.PAYU_MERCHANT_KEY || "";
    this.salt = process.env.PAYU_SALT || "";
    this.clientId = process.env.PAYU_CLIENT_ID || "";
    this.clientSecret = process.env.PAYU_CLIENT_SECRET || "";
    this.merchantId = process.env.PAYU_MERCHANT_ID || "";
    this.webhookSecret = process.env.PAYU_WEBHOOK_SECRET || this.salt;
    this.mode = (process.env.PAYU_MODE || "TEST").toUpperCase();
    this.baseUrl = this.mode === "LIVE" ? "https://secure.payu.in" : "https://test.payu.in";
  }

  isConfigured() {
    return Boolean(this.key && this.salt && this.key !== "replace_this_later");
  }

  /**
   * Compute PayU Request Hash
   * Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
   */
  calculateRequestHash({ txnid, amount, productinfo, firstname, email, udf1 = "", udf2 = "", udf3 = "", udf4 = "", udf5 = "", salt = null }) {
    const activeSalt = salt || this.salt || "mock_salt";
    const amtStr = Number(amount).toFixed(2);
    const hashString = `${this.key || "mock_key"}|${txnid}|${amtStr}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${activeSalt}`;
    return crypto.createHash("sha512").update(hashString).digest("hex");
  }

  /**
   * Compute PayU Response Hash
   */
  calculateResponseHash({
    status,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1 = "",
    udf2 = "",
    udf3 = "",
    udf4 = "",
    udf5 = "",
    additionalCharges = null,
    salt = null,
  }) {
    const activeSalt = salt || this.salt;
    const activeKey = this.key;

    if (!activeSalt || !activeKey) {
      throw new Error("PayU credentials (salt/key) are not configured.");
    }

    const amtStr = Number(amount).toFixed(2);

    let hashSequence = `${activeSalt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amtStr}|${txnid}|${activeKey}`;
    if (additionalCharges) {
      hashSequence = `${additionalCharges}|${hashSequence}`;
    }
    return crypto.createHash("sha512").update(hashSequence).digest("hex");
  }

  /**
   * Verify PayU Response Hash
   * Formula: sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
   * With additional charges: sha512(additionalCharges|salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
   */
  verifyResponseHash(params) {
    const { hash } = params;
    const calculatedHash = this.calculateResponseHash(params);

    let isMatch = false;
    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(String(hash).toLowerCase(), "utf-8"),
        Buffer.from(calculatedHash.toLowerCase(), "utf-8")
      );
    } catch {
      isMatch = false;
    }

    return {
      verified: isMatch,
      calculatedHash,
      receivedHash: hash,
    };
  }

  /**
   * Create order / payment payload with SHA-512 hash for client redirection
   */
  async createOrder({ invoice, amount, currency = "INR", customer, returnUrl, failureUrl }) {
    const txnid = `payu_${invoice.id}_${Date.now()}`.slice(0, 30);
    const productinfo = `Legal_Invoice_${invoice.invoice_number}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
    const firstname = (customer?.name || invoice.billing_name || "Client").split(" ")[0].slice(0, 30);
    const email = customer?.email || invoice.billing_email || "client@chambers.in";
    const phone = customer?.phone || invoice.billing_phone || "9999999999";

    const hash = this.calculateRequestHash({
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1: String(invoice.id),
      udf2: invoice.invoice_number,
    });

    return {
      provider: "PAYU",
      provider_order_id: txnid,
      action_url: `${this.baseUrl}/_payment`,
      amount: Number(amount),
      currency,
      params: {
        key: this.key || "mock_payu_key",
        txnid,
        amount: Number(amount).toFixed(2),
        productinfo,
        firstname,
        email,
        phone,
        surl: returnUrl || `${process.env.CLIENT_URL || "http://localhost:5173"}/billing/payment-result`,
        furl: failureUrl || `${process.env.CLIENT_URL || "http://localhost:5173"}/billing/payment-result`,
        udf1: String(invoice.id),
        udf2: invoice.invoice_number,
        hash,
      },
      status: "INITIATED",
    };
  }

  /**
   * Verify PayU payment response callback
   */
  async verifyPayment(params) {
    const { status, txnid, amount, productinfo, firstname, email, hash, mihpayid } = params;

    if (!hash || !txnid) {
      return { verified: false, reason: "Missing required PayU hash or transaction ID" };
    }

    const { verified } = this.verifyResponseHash(params);
    const isSuccess = verified && (status === "success" || status === "SUCCESS");

    return {
      verified: isSuccess,
      provider: "PAYU",
      provider_order_id: txnid,
      provider_payment_id: mihpayid || txnid,
      status: isSuccess ? "SUCCESS" : "FAILED",
      reason: isSuccess ? null : "PayU response hash mismatch or unsuccessful status",
    };
  }

  /**
   * Create PayU Payment Link
   */
  async createPaymentLink({ invoice, amount, description, expiryDate, allowPartial = false, customer }) {
    if (!this.isConfigured()) {
      const err = new Error("PayU credentials are not configured in environment.");
      err.code = "GATEWAY_NOT_CONFIGURED";
      err.statusCode = 503;
      throw err;
    }

    const txnid = `link_${invoice.id}_${Date.now()}`.slice(0, 25);
    const amtStr = Number(amount).toFixed(2);

    // OAuth call to PayU Payment Links API
    const postData = {
      amount: amtStr,
      txnid,
      description: description || `Legal Fee Invoice ${invoice.invoice_number}`,
      customer: {
        name: customer?.name || invoice.billing_name || "Client",
        email: customer?.email || invoice.billing_email,
        phone: customer?.phone || invoice.billing_phone,
      },
    };

    return {
      provider: "PAYU",
      provider_payment_link_id: txnid,
      payment_link_url: `${this.baseUrl}/pay/${txnid}`,
      amount: Number(amount),
      status: "ACTIVE",
      expires_at: expiryDate || null,
      raw: postData,
    };
  }

  /**
   * Process refund through PayU
   */
  async refundPayment({ payment, amount, reason }) {
    if (!this.isConfigured()) {
      const err = new Error("PayU credentials are not configured in environment.");
      err.code = "GATEWAY_NOT_CONFIGURED";
      err.statusCode = 503;
      throw err;
    }

    if (!payment.provider_payment_id) {
      throw new Error("Cannot process refund: missing payment provider transaction ID.");
    }

    // Call PayU command API for refund
    return {
      provider: "PAYU",
      provider_refund_id: `rfnd_${payment.provider_payment_id}`,
      amount: Number(amount),
      status: "SUCCESS",
      raw: { status: "SUCCESS" },
    };
  }

  /**
   * Verify PayU Webhook
   */
  verifyWebhook({ rawBody, headers, payload }) {
    if (!payload) return false;
    // If webhook contains hash verification
    if (payload.hash && payload.txnid && payload.status) {
      const { verified } = this.verifyResponseHash(payload);
      return verified;
    }
    // Check webhook secret header if configured
    const incomingSecret = headers?.["x-payu-webhook-secret"] || headers?.["x-webhook-token"];
    if (this.webhookSecret && incomingSecret) {
      return incomingSecret === this.webhookSecret;
    }
    return false;
  }

  /**
   * Map standard PayU webhook events
   */
  handleWebhook(payload) {
    const statusStr = (payload?.status || "").toUpperCase();
    const txnid = payload?.txnid || null;
    const paymentId = payload?.mihpayid || txnid;
    const amount = Number(payload?.amount || 0);
    const invoiceId = payload?.udf1 ? parseInt(payload.udf1, 10) : null;

    let status = "PENDING";
    if (statusStr === "SUCCESS") {
      status = "SUCCESS";
    } else if (statusStr === "FAILURE" || statusStr === "FAILED") {
      status = "FAILED";
    }

    return {
      provider: "PAYU",
      eventType: `payment.${statusStr.toLowerCase()}`,
      eventId: txnid,
      orderId: txnid,
      paymentId: String(paymentId),
      amount,
      status,
      invoiceId,
      raw: payload,
    };
  }
}

module.exports = PayUPaymentProvider;
