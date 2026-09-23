const crypto = require("crypto");
const db = require("../config/database");
const { getPaymentProvider } = require("../services/paymentProviderFactory");
const { verifyAndCaptureGatewayPayment } = require("../services/paymentService");

/**
 * Handle incoming Razorpay Webhooks
 */
const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}), "utf-8");
    const provider = getPaymentProvider("RAZORPAY");

    // 1. Verify Raw Body HMAC Signature
    const isValid = provider.verifyWebhook({
      rawBody,
      headers: req.headers,
    });

    if (!isValid) {
      console.warn("[Razorpay Webhook Warning]: Invalid webhook signature rejected.");
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const payload = req.body || {};
    const eventId = payload.id || payload.event_id || null;
    const eventType = payload.event || "unknown";

    // 2. Compute payload hash for replay / duplicate protection
    const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");

    // Check if duplicate
    const [existing] = await db.query(
      `SELECT id, processed FROM webhook_events 
       WHERE provider = 'RAZORPAY' AND (payload_hash = ? OR (event_id IS NOT NULL AND event_id = ?))
       LIMIT 1`,
      [payloadHash, eventId]
    );

    if (existing.length > 0 && existing[0].processed) {
      // Already processed safely without duplicate allocation
      return res.status(200).json({ status: "ok", duplicate: true });
    }

    let webhookEventId;
    if (existing.length === 0) {
      const [insertRes] = await db.query(
        `INSERT INTO webhook_events (provider, event_id, event_type, signature_valid, payload_hash)
         VALUES ('RAZORPAY', ?, ?, 1, ?)`,
        [eventId, eventType, payloadHash]
      );
      webhookEventId = insertRes.insertId;
    } else {
      webhookEventId = existing[0].id;
    }

    // 3. Map event and process payment capture if successful
    const normalized = provider.handleWebhook(payload);

    if (normalized.status === "SUCCESS" && normalized.invoiceId) {
      await verifyAndCaptureGatewayPayment("RAZORPAY", {
        order_id: normalized.orderId,
        payment_id: normalized.paymentId,
        invoice_id: normalized.invoiceId,
        amount: normalized.amount,
      });
    }

    // Mark as processed
    await db.query(
      `UPDATE webhook_events SET processed = 1, processed_at = NOW() WHERE id = ?`,
      [webhookEventId]
    );

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("[Razorpay Webhook Error]:", err);
    return res.status(500).json({ error: "Webhook processing error" });
  }
};

/**
 * Handle incoming PayU Webhooks
 */
const handlePayUWebhook = async (req, res, next) => {
  try {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}), "utf-8");
    const provider = getPaymentProvider("PAYU");
    const payload = req.body || {};

    const isValid = provider.verifyWebhook({
      rawBody,
      headers: req.headers,
      payload,
    });

    if (!isValid) {
      console.warn("[PayU Webhook Warning]: Invalid webhook signature or hash rejected.");
      return res.status(400).json({ error: "Invalid webhook hash" });
    }

    const eventId = payload.txnid || payload.mihpayid || null;
    const eventType = payload.status ? `payment.${payload.status.toLowerCase()}` : "payment.status";
    const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");

    // Idempotency check
    const [existing] = await db.query(
      `SELECT id, processed FROM webhook_events 
       WHERE provider = 'PAYU' AND (payload_hash = ? OR (event_id IS NOT NULL AND event_id = ?))
       LIMIT 1`,
      [payloadHash, eventId]
    );

    if (existing.length > 0 && existing[0].processed) {
      return res.status(200).json({ status: "ok", duplicate: true });
    }

    let webhookEventId;
    if (existing.length === 0) {
      const [insertRes] = await db.query(
        `INSERT INTO webhook_events (provider, event_id, event_type, signature_valid, payload_hash)
         VALUES ('PAYU', ?, ?, 1, ?)`,
        [eventId, eventType, payloadHash]
      );
      webhookEventId = insertRes.insertId;
    } else {
      webhookEventId = existing[0].id;
    }

    const normalized = provider.handleWebhook(payload);

    if (normalized.status === "SUCCESS" && normalized.invoiceId) {
      await verifyAndCaptureGatewayPayment("PAYU", {
        order_id: normalized.orderId,
        payment_id: normalized.paymentId,
        invoice_id: normalized.invoiceId,
        amount: normalized.amount,
        hash: payload.hash,
      });
    }

    await db.query(
      `UPDATE webhook_events SET processed = 1, processed_at = NOW() WHERE id = ?`,
      [webhookEventId]
    );

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("[PayU Webhook Error]:", err);
    return res.status(500).json({ error: "Webhook processing error" });
  }
};

module.exports = {
  handleRazorpayWebhook,
  handlePayUWebhook,
};
