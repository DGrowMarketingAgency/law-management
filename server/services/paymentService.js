const db = require("../config/database");
const { roundDec2, calculateAmountDue } = require("./billingCalculationService");
const { generateReceiptNumber } = require("./invoiceNumberService");
const { logBillingEvent } = require("./billingAuditService");
const { getPaymentProvider } = require("./paymentProviderFactory");
const { sendEmail } = require("./emailService");
const { sendWhatsAppMessage } = require("./whatsappService");

const ALLOWED_PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "UPI",
  "UPI_MANUAL",
  "CARD",
  "CHEQUE",
  "RETAINER_DRAW",
  "ONLINE_GATEWAY",
  "RAZORPAY",
  "PAYU",
  "OTHER",
];

const PAYABLE_STATUSES = ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"];

/**
 * Record a payment against an issued invoice (Prompt 8 direct record / internal draw)
 * @param {object} paymentData
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const recordPayment = async (paymentData, userId, ip = null, userAgent = null) => {
  const {
    invoice_id,
    amount,
    payment_date,
    payment_method = "BANK_TRANSFER",
    payment_type = "MANUAL",
    provider = null,
    reference_number,
    transaction_id,
    notes,
    retainer_id,
    proof_document_id = null,
    idempotency_key = null,
  } = paymentData;

  if (!invoice_id) {
    const err = new Error("invoice_id is required.");
    err.statusCode = 422;
    throw err;
  }

  const payAmount = roundDec2(amount);
  if (payAmount <= 0) {
    const err = new Error("Payment amount must be greater than zero.");
    err.statusCode = 422;
    throw err;
  }

  if (!payment_date) {
    const err = new Error("payment_date is required.");
    err.statusCode = 422;
    throw err;
  }

  if (!ALLOWED_PAYMENT_METHODS.includes(payment_method)) {
    const err = new Error(
      `Invalid payment_method: ${payment_method}. Allowed: ${ALLOWED_PAYMENT_METHODS.join(", ")}`
    );
    err.statusCode = 422;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Lock invoice row for update to prevent concurrent double payment
    const [invRows] = await conn.query(
      `SELECT id, invoice_number, client_id, status, total_amount, amount_paid, amount_due, due_date
       FROM invoices 
       WHERE id = ? FOR UPDATE`,
      [invoice_id]
    );

    if (invRows.length === 0) {
      const err = new Error("Invoice not found.");
      err.statusCode = 404;
      throw err;
    }

    const invoice = invRows[0];

    if (!PAYABLE_STATUSES.includes(invoice.status)) {
      const err = new Error(
        `Cannot record payment on invoice ${invoice.invoice_number} with status '${invoice.status}'. Payment is only permitted on ISSUED, SENT, PARTIALLY_PAID, or OVERDUE invoices.`
      );
      err.statusCode = 422;
      throw err;
    }

    const currentDue = roundDec2(invoice.amount_due);

    // 2. Overpayment check
    if (payAmount > currentDue) {
      const err = new Error(
        `Payment amount (₹${payAmount}) exceeds the current outstanding balance (₹${currentDue}). Overpayment is not permitted.`
      );
      err.statusCode = 422;
      throw err;
    }

    // 3. If payment_method is RETAINER_DRAW, verify retainer trust account
    let drawDownRetainer = null;
    if (payment_method === "RETAINER_DRAW") {
      if (!retainer_id) {
        const err = new Error("retainer_id is required when payment_method is RETAINER_DRAW.");
        err.statusCode = 422;
        throw err;
      }

      const [retRows] = await conn.query(
        `SELECT id, name, current_balance, client_id FROM retainers WHERE id = ? FOR UPDATE`,
        [retainer_id]
      );

      if (retRows.length === 0) {
        const err = new Error("Retainer account not found.");
        err.statusCode = 404;
        throw err;
      }

      drawDownRetainer = retRows[0];
      if (drawDownRetainer.client_id !== invoice.client_id) {
        const err = new Error("Retainer account belongs to a different client.");
        err.statusCode = 422;
        throw err;
      }

      if (drawDownRetainer.current_balance < payAmount) {
        const err = new Error(
          `Insufficient retainer balance (₹${drawDownRetainer.current_balance}) for requested draw-down (₹${payAmount}).`
        );
        err.statusCode = 422;
        throw err;
      }
    }

    // 4. Generate unique sequential receipt number
    const receiptNumber = await generateReceiptNumber(conn, new Date(payment_date).getFullYear());

    // 5. Insert Payment Record
    const [payResult] = await conn.query(
      `INSERT INTO payments (
        receipt_number, client_id, invoice_id, payment_type, payment_date, amount,
        payment_method, provider, reference_number, transaction_id, status, notes,
        received_by, verified_at, verified_by, proof_document_id, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, NOW(), ?, ?, ?)`,
      [
        receiptNumber,
        invoice.client_id,
        invoice.id,
        payment_type,
        payment_date,
        payAmount,
        payment_method,
        provider || (payment_method === "RETAINER_DRAW" ? "RETAINER" : "MANUAL"),
        reference_number || (payment_method === "RETAINER_DRAW" ? `Retainer Draw #${retainer_id}` : null),
        transaction_id || null,
        notes || null,
        userId || null,
        userId || null,
        proof_document_id || null,
        idempotency_key || null,
      ]
    );

    const paymentId = payResult.insertId;

    // 6. If Retainer Draw, update retainer balance and write transaction ledger
    if (drawDownRetainer) {
      const newRetainerBal = roundDec2(drawDownRetainer.current_balance - payAmount);
      await conn.query(
        `UPDATE retainers SET current_balance = ? WHERE id = ?`,
        [newRetainerBal, drawDownRetainer.id]
      );

      await conn.query(
        `INSERT INTO retainer_transactions (
          retainer_id, amount, transaction_date, balance_after,
          transaction_type, invoice_id, reference, description, created_by
        ) VALUES (?, ?, ?, ?, 'DRAW_DOWN', ?, ?, ?, ?)`,
        [
          drawDownRetainer.id,
          payAmount,
          payment_date,
          newRetainerBal,
          invoice.id,
          receiptNumber,
          `Draw-down for invoice ${invoice.invoice_number}`,
          userId || null,
        ]
      );
    }

    // 7. Update Invoice amounts and status
    const newAmountPaid = roundDec2(invoice.amount_paid + payAmount);
    const newAmountDue = calculateAmountDue(invoice.total_amount, newAmountPaid);
    const newStatus = newAmountDue === 0 ? "PAID" : "PARTIALLY_PAID";

    await conn.query(
      `UPDATE invoices SET
        amount_paid = ?,
        amount_due = ?,
        status = ?
       WHERE id = ?`,
      [newAmountPaid, newAmountDue, newStatus, invoice.id]
    );

    // 8. Audit logs
    await logBillingEvent(
      userId,
      "PAYMENT_SUCCESS",
      "PAYMENT",
      paymentId,
      ip,
      userAgent,
      {
        receiptNumber,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amount: payAmount,
        method: payment_method,
        newStatus,
        remainingDue: newAmountDue,
      },
      conn
    );

    await logBillingEvent(
      userId,
      "RECEIPT_GENERATED",
      "PAYMENT",
      paymentId,
      ip,
      userAgent,
      {
        receiptNumber,
        invoiceNumber: invoice.invoice_number,
        amount: payAmount,
      },
      conn
    );

    await conn.commit();
    return getPaymentById(paymentId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Initiate an Online Gateway Order (Razorpay / PayU)
 * @param {object} params
 * @param {object} user
 * @returns {Promise<object>}
 */
const createGatewayOrder = async ({ invoiceId, amount, provider = "RAZORPAY", returnUrl, failureUrl }, user) => {
  const conn = await db.getConnection();
  try {
    const [invRows] = await conn.query(
      `SELECT inv.*, cnt.display_name AS client_name, cnt.email AS client_email, cnt.phone AS client_phone
       FROM invoices inv
       JOIN clients cl ON inv.client_id = cl.id
       JOIN contacts cnt ON cl.contact_id = cnt.id
       WHERE inv.id = ?`,
      [invoiceId]
    );

    if (invRows.length === 0) {
      const err = new Error("Invoice not found.");
      err.statusCode = 404;
      throw err;
    }

    const invoice = invRows[0];

    if (!PAYABLE_STATUSES.includes(invoice.status)) {
      const err = new Error(`Invoice #${invoice.invoice_number} cannot accept payments in '${invoice.status}' status.`);
      err.statusCode = 422;
      throw err;
    }

    const requestedAmount = amount ? roundDec2(amount) : roundDec2(invoice.amount_due);
    if (requestedAmount <= 0) {
      const err = new Error("Requested payment amount must be greater than zero.");
      err.statusCode = 422;
      throw err;
    }

    if (requestedAmount > roundDec2(invoice.amount_due)) {
      const err = new Error(
        `Requested amount (₹${requestedAmount}) exceeds outstanding balance (₹${invoice.amount_due}).`
      );
      err.statusCode = 422;
      throw err;
    }

    const paymentProvider = getPaymentProvider(provider);
    const orderData = await paymentProvider.createOrder({
      invoice,
      amount: requestedAmount,
      currency: invoice.currency || "INR",
      customer: {
        name: invoice.client_name || invoice.billing_name,
        email: invoice.client_email || invoice.billing_email,
        phone: invoice.client_phone || invoice.billing_phone,
      },
      returnUrl,
      failureUrl,
    });

    // Record initiated transaction in payment_gateway_transactions
    await conn.query(
      `INSERT INTO payment_gateway_transactions (
        invoice_id, client_id, provider, provider_order_id, amount, currency, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'INITIATED')`,
      [
        invoice.id,
        invoice.client_id,
        provider.toUpperCase(),
        orderData.provider_order_id,
        requestedAmount,
        invoice.currency || "INR",
      ]
    );

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      amount: requestedAmount,
      currency: invoice.currency || "INR",
      provider: provider.toUpperCase(),
      orderId: orderData.provider_order_id,
      keyId: orderData.key_id || null,
      actionUrl: orderData.action_url || null,
      params: orderData.params || null,
    };
  } finally {
    conn.release();
  }
};

/**
 * Verify and idempotently capture an online gateway payment callback or webhook
 * @param {string} providerName
 * @param {object} payload
 * @param {number} [userId]
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const verifyAndCaptureGatewayPayment = async (providerName, payload, userId = null, ip = null, userAgent = null) => {
  const provider = getPaymentProvider(providerName);
  const verifyResult = await provider.verifyPayment(payload);

  if (!verifyResult.verified) {
    await logBillingEvent(userId, "PAYMENT_SIGNATURE_FAILED", "PAYMENT", 0, ip, userAgent, {
      provider: providerName,
      reason: verifyResult.reason,
      payload,
    });
    const err = new Error(verifyResult.reason || "Payment signature/hash verification failed.");
    err.statusCode = 400;
    err.code = "SIGNATURE_VERIFICATION_FAILED";
    throw err;
  }

  const orderId = verifyResult.provider_order_id || payload.order_id || payload.razorpay_order_id || payload.txnid;
  const paymentId = verifyResult.provider_payment_id || payload.payment_id || payload.razorpay_payment_id || payload.mihpayid;

  // 1. Idempotency Check: prevent processing the same payment twice
  const [existingPayments] = await db.query(
    `SELECT p.*, inv.invoice_number 
     FROM payments p
     JOIN invoices inv ON p.invoice_id = inv.id
     WHERE p.provider = ? AND p.provider_payment_id = ?
     LIMIT 1`,
    [providerName.toUpperCase(), paymentId]
  );

  if (existingPayments.length > 0) {
    return {
      success: true,
      duplicate: true,
      message: "Payment was already verified and captured successfully.",
      payment: existingPayments[0],
    };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Locate transaction record to map invoice and amount
    const [txRows] = await conn.query(
      `SELECT * FROM payment_gateway_transactions 
       WHERE provider = ? AND provider_order_id = ? 
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [providerName.toUpperCase(), orderId]
    );

    let invoiceId = txRows.length > 0 ? txRows[0].invoice_id : (payload.invoice_id ? parseInt(payload.invoice_id, 10) : null);
    let captureAmount = txRows.length > 0 ? roundDec2(txRows[0].amount) : (payload.amount ? roundDec2(payload.amount) : null);

    if (!invoiceId) {
      const err = new Error("Could not map gateway transaction to chambers invoice.");
      err.statusCode = 422;
      throw err;
    }

    // Lock invoice row
    const [invRows] = await conn.query(
      `SELECT id, invoice_number, client_id, status, total_amount, amount_paid, amount_due 
       FROM invoices WHERE id = ? FOR UPDATE`,
      [invoiceId]
    );

    if (invRows.length === 0) {
      const err = new Error("Target invoice not found.");
      err.statusCode = 404;
      throw err;
    }

    const invoice = invRows[0];
    if (!captureAmount || captureAmount <= 0) {
      captureAmount = roundDec2(invoice.amount_due);
    }

    const receiptNumber = await generateReceiptNumber(conn, new Date().getFullYear());

    // Insert payment record
    const [payResult] = await conn.query(
      `INSERT INTO payments (
        receipt_number, client_id, invoice_id, payment_type, payment_date, amount,
        payment_method, provider, provider_order_id, provider_payment_id,
        reference_number, status, notes, received_by, verified_at, verified_by
      ) VALUES (?, ?, ?, 'ONLINE_GATEWAY', CURRENT_DATE(), ?, 'ONLINE_GATEWAY', ?, ?, ?, ?, 'SUCCESS', ?, ?, NOW(), ?)`,
      [
        receiptNumber,
        invoice.client_id,
        invoice.id,
        captureAmount,
        providerName.toUpperCase(),
        orderId,
        paymentId,
        paymentId,
        `Captured via ${providerName} (Order: ${orderId})`,
        userId || null,
        userId || null,
      ]
    );

    const paymentRecordId = payResult.insertId;

    // Update gateway transaction ledger
    if (txRows.length > 0) {
      await conn.query(
        `UPDATE payment_gateway_transactions SET
          payment_id = ?,
          provider_payment_id = ?,
          status = 'SUCCESS',
          verified = 1,
          verified_at = NOW(),
          raw_response_redacted = ?
         WHERE id = ?`,
        [paymentRecordId, paymentId, JSON.stringify(payload), txRows[0].id]
      );
    }

    // Allocate payment to invoice
    const newAmountPaid = roundDec2(invoice.amount_paid + captureAmount);
    const newAmountDue = calculateAmountDue(invoice.total_amount, newAmountPaid);
    const newStatus = newAmountDue === 0 ? "PAID" : "PARTIALLY_PAID";

    await conn.query(
      `UPDATE invoices SET
        amount_paid = ?,
        amount_due = ?,
        status = ?
       WHERE id = ?`,
      [newAmountPaid, newAmountDue, newStatus, invoice.id]
    );

    await logBillingEvent(userId, "PAYMENT_SUCCESS", "PAYMENT", paymentRecordId, ip, userAgent, {
      receiptNumber,
      provider: providerName,
      orderId,
      paymentId,
      amount: captureAmount,
      invoiceNumber: invoice.invoice_number,
      newStatus,
    }, conn);

    await conn.commit();
    return getPaymentById(paymentRecordId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Record a Manual or Client-submitted Payment (PENDING_VERIFICATION)
 * @param {object} paymentData
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const recordManualPayment = async (paymentData, userId, ip = null, userAgent = null) => {
  const {
    invoice_id,
    amount,
    payment_date,
    payment_method = "BANK_TRANSFER",
    reference_number,
    transaction_id,
    notes,
    proof_document_id = null,
  } = paymentData;

  if (!invoice_id) {
    const err = new Error("invoice_id is required.");
    err.statusCode = 422;
    throw err;
  }

  const payAmount = roundDec2(amount);
  if (payAmount <= 0) {
    const err = new Error("Payment amount must be greater than zero.");
    err.statusCode = 422;
    throw err;
  }

  const [invRows] = await db.query(
    `SELECT id, invoice_number, client_id, status, amount_due FROM invoices WHERE id = ?`,
    [invoice_id]
  );

  if (invRows.length === 0) {
    const err = new Error("Invoice not found.");
    err.statusCode = 404;
    throw err;
  }

  const invoice = invRows[0];
  if (!PAYABLE_STATUSES.includes(invoice.status)) {
    const err = new Error(`Cannot record payment on invoice #${invoice.invoice_number} with status '${invoice.status}'.`);
    err.statusCode = 422;
    throw err;
  }

  if (payAmount > roundDec2(invoice.amount_due)) {
    const err = new Error(`Payment amount (₹${payAmount}) exceeds invoice outstanding balance (₹${invoice.amount_due}).`);
    err.statusCode = 422;
    throw err;
  }

  // Initial status
  const initialStatus = payment_method === "CHEQUE" ? "PENDING_CLEARANCE" : "PENDING_VERIFICATION";
  const tempReceiptNumber = `PEND-${invoice.invoice_number}-${Date.now().toString().slice(-4)}`;

  const [res] = await db.query(
    `INSERT INTO payments (
      receipt_number, client_id, invoice_id, payment_type, payment_date, amount,
      payment_method, provider, reference_number, transaction_id, status, notes,
      received_by, proof_document_id
    ) VALUES (?, ?, ?, 'MANUAL', ?, ?, ?, 'MANUAL', ?, ?, ?, ?, ?, ?)`,
    [
      tempReceiptNumber,
      invoice.client_id,
      invoice.id,
      payment_date || new Date().toISOString().slice(0, 10),
      payAmount,
      payment_method,
      reference_number || null,
      transaction_id || null,
      initialStatus,
      notes || null,
      userId || null,
      proof_document_id || null,
    ]
  );

  const paymentId = res.insertId;

  await logBillingEvent(userId, "PAYMENT_MANUAL_CREATED", "PAYMENT", paymentId, ip, userAgent, {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    amount: payAmount,
    method: payment_method,
    referenceNumber: reference_number,
    status: initialStatus,
  });

  return getPaymentById(paymentId);
};

/**
 * Verify a Manual or Offline Payment (Authorized billing staff)
 * @param {number} paymentId
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const verifyManualPayment = async (paymentId, userId, ip = null, userAgent = null) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [payRows] = await conn.query(
      `SELECT * FROM payments WHERE id = ? FOR UPDATE`,
      [paymentId]
    );

    if (payRows.length === 0) {
      const err = new Error("Payment record not found.");
      err.statusCode = 404;
      throw err;
    }

    const payment = payRows[0];

    if (!["PENDING_VERIFICATION", "PENDING_CLEARANCE"].includes(payment.status)) {
      const err = new Error(`Payment #${paymentId} cannot be verified from status '${payment.status}'.`);
      err.statusCode = 422;
      throw err;
    }

    const [invRows] = await conn.query(
      `SELECT id, invoice_number, total_amount, amount_paid, amount_due, status FROM invoices WHERE id = ? FOR UPDATE`,
      [payment.invoice_id]
    );

    if (invRows.length === 0) {
      const err = new Error("Associated invoice not found.");
      err.statusCode = 404;
      throw err;
    }

    const invoice = invRows[0];

    // Generate official sequential receipt number
    const officialReceipt = await generateReceiptNumber(conn, new Date(payment.payment_date).getFullYear());

    // Update payment record to SUCCESS
    await conn.query(
      `UPDATE payments SET
        receipt_number = ?,
        status = 'SUCCESS',
        verified_at = NOW(),
        verified_by = ?
       WHERE id = ?`,
      [officialReceipt, userId || null, paymentId]
    );

    // Allocate payment to invoice
    const newAmountPaid = roundDec2(Number(invoice.amount_paid) + Number(payment.amount));
    const newAmountDue = calculateAmountDue(invoice.total_amount, newAmountPaid);
    const newStatus = newAmountDue === 0 ? "PAID" : "PARTIALLY_PAID";

    await conn.query(
      `UPDATE invoices SET
        amount_paid = ?,
        amount_due = ?,
        status = ?
       WHERE id = ?`,
      [newAmountPaid, newAmountDue, newStatus, invoice.id]
    );

    await logBillingEvent(userId, "PAYMENT_MANUAL_VERIFIED", "PAYMENT", paymentId, ip, userAgent, {
      officialReceipt,
      amount: payment.amount,
      invoiceNumber: invoice.invoice_number,
      verifiedBy: userId,
    }, conn);

    await conn.commit();
    return getPaymentById(paymentId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Reject a Manual Payment
 * @param {number} paymentId
 * @param {string} reason
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const rejectManualPayment = async (paymentId, reason, userId, ip = null, userAgent = null) => {
  if (!reason || !reason.trim()) {
    const err = new Error("Rejection reason is required.");
    err.statusCode = 422;
    throw err;
  }

  const [payRows] = await db.query(
    `SELECT * FROM payments WHERE id = ?`,
    [paymentId]
  );

  if (payRows.length === 0) {
    const err = new Error("Payment record not found.");
    err.statusCode = 404;
    throw err;
  }

  const payment = payRows[0];
  if (!["PENDING_VERIFICATION", "PENDING_CLEARANCE"].includes(payment.status)) {
    const err = new Error(`Payment #${paymentId} cannot be rejected from status '${payment.status}'.`);
    err.statusCode = 422;
    throw err;
  }

  await db.query(
    `UPDATE payments SET
      status = 'REJECTED',
      rejection_reason = ?,
      verified_by = ?,
      verified_at = NOW()
     WHERE id = ?`,
    [reason.trim(), userId || null, paymentId]
  );

  await logBillingEvent(userId, "PAYMENT_MANUAL_REJECTED", "PAYMENT", paymentId, ip, userAgent, {
    paymentId,
    reason,
    verifiedBy: userId,
  });

  return getPaymentById(paymentId);
};

/**
 * Generate or retrieve an active Payment Link for an invoice
 * @param {object} params
 * @param {number} userId
 * @returns {Promise<object>}
 */
const createPaymentLink = async ({ invoiceId, amount, description, expiryDate, allowPartial = false, provider = "RAZORPAY" }, userId) => {
  const [invRows] = await db.query(
    `SELECT inv.*, cnt.display_name AS client_name, cnt.email AS client_email, cnt.phone AS client_phone
     FROM invoices inv
     JOIN clients cl ON inv.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     WHERE inv.id = ?`,
    [invoiceId]
  );

  if (invRows.length === 0) {
    const err = new Error("Invoice not found.");
    err.statusCode = 404;
    throw err;
  }

  const invoice = invRows[0];
  if (invoice.amount_due <= 0 || ["PAID", "CANCELLED", "VOID"].includes(invoice.status)) {
    const err = new Error(`Invoice #${invoice.invoice_number} does not have an outstanding balance.`);
    err.statusCode = 422;
    throw err;
  }

  // 1. Check for active unexpired payment link to reuse
  const [existingLinks] = await db.query(
    `SELECT * FROM payment_links 
     WHERE invoice_id = ? AND provider = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY id DESC LIMIT 1`,
    [invoice.id, provider.toUpperCase()]
  );

  if (existingLinks.length > 0) {
    return existingLinks[0];
  }

  const linkAmount = amount ? roundDec2(amount) : roundDec2(invoice.amount_due);
  const paymentProvider = getPaymentProvider(provider);

  const linkResult = await paymentProvider.createPaymentLink({
    invoice,
    amount: linkAmount,
    description: description || `Legal fee payment for invoice #${invoice.invoice_number}`,
    expiryDate: expiryDate || null,
    allowPartial,
    customer: {
      name: invoice.client_name || invoice.billing_name,
      email: invoice.client_email || invoice.billing_email,
      phone: invoice.client_phone || invoice.billing_phone,
    },
  });

  const [res] = await db.query(
    `INSERT INTO payment_links (
      invoice_id, client_id, provider, provider_payment_link_id, payment_link_url,
      amount, status, allow_partial, description, expires_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
    [
      invoice.id,
      invoice.client_id,
      provider.toUpperCase(),
      linkResult.provider_payment_link_id,
      linkResult.payment_link_url,
      linkAmount,
      allowPartial ? 1 : 0,
      description || null,
      expiryDate || null,
      userId || null,
    ]
  );

  await logBillingEvent(userId, "PAYMENT_LINK_CREATED", "INVOICE", invoice.id, null, null, {
    linkId: res.insertId,
    provider,
    url: linkResult.payment_link_url,
    amount: linkAmount,
  });

  const [created] = await db.query(`SELECT * FROM payment_links WHERE id = ?`, [res.insertId]);
  return created[0];
};

/**
 * Refund / Reverse a payment (Enhanced with partial refund & provider sync)
 * @param {number} id
 * @param {string} reason
 * @param {number} [amount]
 * @param {number} [userId]
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const refundPayment = async (id, reason, amount = null, userId = null, ip = null, userAgent = null) => {
  if (!reason || !reason.trim()) {
    const err = new Error("A reason is required to refund a payment.");
    err.statusCode = 422;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [payRows] = await conn.query(
      `SELECT * FROM payments WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (payRows.length === 0) {
      const err = new Error("Payment record not found.");
      err.statusCode = 404;
      throw err;
    }

    const payment = payRows[0];

    if (!["SUCCESS", "PARTIALLY_REFUNDED"].includes(payment.status)) {
      const err = new Error(`Cannot refund payment #${id} with status '${payment.status}'.`);
      err.statusCode = 422;
      throw err;
    }

    // Check previously refunded amounts
    const [refundRows] = await conn.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_refunded FROM payment_refunds WHERE payment_id = ? AND status = 'SUCCESS'`,
      [id]
    );
    const previouslyRefunded = roundDec2(refundRows[0].total_refunded);
    const refundableBalance = roundDec2(payment.amount - previouslyRefunded);

    const requestedRefund = amount ? roundDec2(amount) : refundableBalance;

    if (requestedRefund <= 0) {
      const err = new Error("Refund amount must be greater than zero.");
      err.statusCode = 422;
      throw err;
    }

    if (requestedRefund > refundableBalance) {
      const err = new Error(
        `Requested refund (₹${requestedRefund}) exceeds refundable balance (₹${refundableBalance}).`
      );
      err.statusCode = 422;
      throw err;
    }

    // Call provider refund API if online gateway
    let providerRefundId = null;
    if (payment.payment_type === "ONLINE_GATEWAY" && payment.provider) {
      try {
        const providerInstance = getPaymentProvider(payment.provider);
        const refRes = await providerInstance.refundPayment({
          payment,
          amount: requestedRefund,
          reason,
        });
        providerRefundId = refRes.provider_refund_id;
      } catch (provErr) {
        // Log failure but proceed with internal reversal if needed
      }
    }

    // Insert into payment_refunds table
    await conn.query(
      `INSERT INTO payment_refunds (
        payment_id, invoice_id, provider, provider_refund_id, amount, reason, status, requested_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?)`,
      [
        payment.id,
        payment.invoice_id,
        payment.provider || "MANUAL",
        providerRefundId,
        requestedRefund,
        reason.trim(),
        userId || null,
      ]
    );

    // Update payment record status
    const isFullyRefunded = requestedRefund === refundableBalance;
    const newPaymentStatus = isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED";

    await conn.query(
      `UPDATE payments SET
        status = ?,
        refunded_at = CURRENT_TIMESTAMP,
        refund_reason = ?,
        refunded_by = ?
       WHERE id = ?`,
      [newPaymentStatus, reason.trim(), userId || null, id]
    );

    // Adjust invoice balances
    const [invRows] = await conn.query(
      `SELECT id, total_amount, amount_paid, amount_due FROM invoices WHERE id = ? FOR UPDATE`,
      [payment.invoice_id]
    );

    if (invRows.length > 0) {
      const inv = invRows[0];
      const newPaid = roundDec2(Math.max(0, Number(inv.amount_paid) - requestedRefund));
      const newDue = calculateAmountDue(inv.total_amount, newPaid);
      const newStatus = newPaid === 0 ? "ISSUED" : "PARTIALLY_PAID";

      await conn.query(
        `UPDATE invoices SET
          amount_paid = ?,
          amount_due = ?,
          status = ?
         WHERE id = ?`,
        [newPaid, newDue, newStatus, inv.id]
      );
    }

    await logBillingEvent(userId, "PAYMENT_REFUND_SUCCESS", "PAYMENT", id, ip, userAgent, {
      receiptNumber: payment.receipt_number,
      refundAmount: requestedRefund,
      reason,
      providerRefundId,
    }, conn);

    await conn.commit();
    return getPaymentById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Get payment by ID
 * @param {number} id
 * @param {number} [clientRestrictionId]
 * @returns {Promise<object>}
 */
const getPaymentById = async (id, clientRestrictionId = null) => {
  let where = "p.id = ?";
  const params = [id];

  if (clientRestrictionId) {
    where += " AND p.client_id = ?";
    params.push(clientRestrictionId);
  }

  const [rows] = await db.execute(
    `SELECT 
      p.*,
      p.receipt_number AS payment_number,
      p.payment_method AS payment_mode,
      inv.invoice_number,
      inv.total_amount AS invoice_total,
      inv.amount_due AS invoice_due,
      cnt.display_name AS client_name,
      cnt.email AS client_email,
      cl.client_code,
      u.first_name AS receiver_first_name,
      u.last_name AS receiver_last_name,
      v_u.first_name AS verifier_first_name,
      v_u.last_name AS verifier_last_name
     FROM payments p
     JOIN invoices inv ON p.invoice_id = inv.id
     JOIN clients cl ON p.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     LEFT JOIN users u ON p.received_by = u.id
     LEFT JOIN users v_u ON p.verified_by = v_u.id
     WHERE ${where}`,
    params
  );

  if (rows.length === 0) {
    const err = new Error("Payment record not found or access denied.");
    err.statusCode = 404;
    throw err;
  }

  const payment = rows[0];

  // Fetch gateway transaction if exists
  const [txRows] = await db.execute(
    `SELECT * FROM payment_gateway_transactions WHERE payment_id = ? LIMIT 1`,
    [id]
  );
  payment.gatewayTransaction = txRows[0] || null;

  // Fetch refunds if exists
  const [refunds] = await db.execute(
    `SELECT * FROM payment_refunds WHERE payment_id = ? ORDER BY id DESC`,
    [id]
  );
  payment.refunds = refunds;
  payment.amount_refunded = roundDec2(
    refunds.filter((r) => r.status === "SUCCESS").reduce((sum, r) => sum + Number(r.amount), 0)
  );

  return payment;
};

/**
 * Get filtered paginated payments
 * @param {object} filters
 * @param {number} [clientRestrictionId]
 * @returns {Promise<object>}
 */
const getPayments = async (filters = {}, clientRestrictionId = null) => {
  const {
    invoice_id,
    client_id,
    status,
    payment_type,
    payment_method,
    provider,
    start_date,
    end_date,
    page = 1,
    limit = 20,
    search,
  } = filters;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const whereClauses = ["1=1"];
  const params = [];

  if (clientRestrictionId) {
    whereClauses.push("p.client_id = ?");
    params.push(clientRestrictionId);
  } else if (client_id) {
    whereClauses.push("p.client_id = ?");
    params.push(client_id);
  }

  if (invoice_id) {
    whereClauses.push("p.invoice_id = ?");
    params.push(invoice_id);
  }

  if (status) {
    whereClauses.push("p.status = ?");
    params.push(status);
  }

  if (payment_type) {
    whereClauses.push("p.payment_type = ?");
    params.push(payment_type);
  }

  if (payment_method) {
    whereClauses.push("p.payment_method = ?");
    params.push(payment_method);
  }

  if (provider) {
    whereClauses.push("p.provider = ?");
    params.push(provider.toUpperCase());
  }

  if (start_date) {
    whereClauses.push("p.payment_date >= ?");
    params.push(start_date);
  }

  if (end_date) {
    whereClauses.push("p.payment_date <= ?");
    params.push(end_date);
  }

  if (search && search.trim()) {
    whereClauses.push("(p.receipt_number LIKE ? OR p.reference_number LIKE ? OR inv.invoice_number LIKE ? OR cnt.display_name LIKE ?)");
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const whereSql = whereClauses.join(" AND ");

  const [countRows] = await db.execute(
    `SELECT 
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN p.status = 'SUCCESS' THEN p.amount ELSE 0 END), 0) AS total_collected
     FROM payments p
     JOIN invoices inv ON p.invoice_id = inv.id
     JOIN clients cl ON p.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     WHERE ${whereSql}`,
    params
  );

  const total = countRows[0].total;

  const [items] = await db.execute(
    `SELECT 
      p.*,
      p.receipt_number AS payment_number,
      p.payment_method AS payment_mode,
      inv.invoice_number,
      cnt.display_name AS client_name,
      cl.client_code,
      u.first_name AS receiver_first_name,
      u.last_name AS receiver_last_name,
      v_u.first_name AS verifier_first_name,
      v_u.last_name AS verifier_last_name
     FROM payments p
     JOIN invoices inv ON p.invoice_id = inv.id
     JOIN clients cl ON p.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     LEFT JOIN users u ON p.received_by = u.id
     LEFT JOIN users v_u ON p.verified_by = v_u.id
     WHERE ${whereSql}
     ORDER BY p.payment_date DESC, p.id DESC
     LIMIT ${limitNum} OFFSET ${offset}`,
    params
  );

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: Math.ceil(total / limitNum) || 1,
    },
    summary: {
      totalCollected: roundDec2(countRows[0].total_collected),
    },
  };
};

module.exports = {
  recordPayment,
  createGatewayOrder,
  verifyAndCaptureGatewayPayment,
  recordManualPayment,
  verifyManualPayment,
  rejectManualPayment,
  createPaymentLink,
  getPaymentById,
  getPayments,
  refundPayment,
};
