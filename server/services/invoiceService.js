const db = require("../config/database");
const {
  roundDec2,
  calculateLineItem,
  calculateInvoiceSubtotal,
  calculateDiscount,
  calculateTaxableAmount,
  calculateTaxes,
  calculateInvoiceTotal,
  calculateAmountDue,
  resolveInvoiceStatus,
} = require("./billingCalculationService");
const {
  generateInvoiceNumber,
  generateDraftInvoiceNumber,
} = require("./invoiceNumberService");
const { logBillingEvent } = require("./billingAuditService");

const ALLOWED_GST_MODES = ["STANDARD", "RCM", "EXEMPT", "NOT_APPLICABLE", "MANUAL_REVIEW"];
const ALLOWED_DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"];

/**
 * Fetch default chambers / advocate billing snapshot information
 * @param {import('mysql2/promise').Connection} conn
 * @returns {Promise<{ advocateBusinessName: string, advocateAddress: string, advocateGstin: string }>}
 */
const getChambersBillingProfile = async (conn) => {
  // Query chambers head / owner profile
  const [rows] = await conn.query(
    `SELECT u.first_name, u.last_name, u.email, u.phone
     FROM users u
     JOIN user_roles ur ON u.id = ur.user_id
     JOIN roles r ON ur.role_id = r.id
     WHERE r.name = 'OWNER'
     LIMIT 1`
  );

  const owner = rows[0] || {};
  return {
    advocateBusinessName: "Advocate's Chambers Legal Practice",
    advocateAddress: "Chambers Suite, High Court Complex, Chennai, Tamil Nadu 600104",
    advocateGstin: "33AAAAA0000A1Z5",
  };
};

/**
 * Create a new DRAFT invoice
 * @param {object} invoiceData
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const createInvoice = async (invoiceData, userId, ip = null, userAgent = null) => {
  const {
    client_id,
    case_id,
    fee_entry_ids = [],
    custom_items = [],
    invoice_date,
    issue_date,
    due_date,
    discount_type = "FIXED",
    discount_value = 0,
    gst_mode = "STANDARD",
    tax_rate = 18.0,
    rcm_applicable = false,
    rcm_reason = null,
    place_of_supply = "Tamil Nadu",
    notes,
    terms,
  } = invoiceData;

  const resolvedInvoiceDate = invoice_date || issue_date;

  if (!client_id) {
    const err = new Error("client_id is required.");
    err.statusCode = 422;
    throw err;
  }

  if (!resolvedInvoiceDate) {
    const err = new Error("invoice_date is required.");
    err.statusCode = 422;
    throw err;
  }

  if (!due_date) {
    const err = new Error("due_date is required.");
    err.statusCode = 422;
    throw err;
  }

  if (new Date(due_date) < new Date(resolvedInvoiceDate)) {
    const err = new Error("due_date cannot be earlier than invoice_date.");
    err.statusCode = 422;
    throw err;
  }

  if (!ALLOWED_GST_MODES.includes(gst_mode)) {
    const err = new Error(`Invalid gst_mode: ${gst_mode}. Allowed: ${ALLOWED_GST_MODES.join(", ")}`);
    err.statusCode = 422;
    throw err;
  }

  if (!ALLOWED_DISCOUNT_TYPES.includes(discount_type)) {
    const err = new Error(`Invalid discount_type: ${discount_type}.`);
    err.statusCode = 422;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Verify Client
    const [clientRows] = await conn.query(
      `SELECT cl.id, cl.client_code, cnt.display_name, cnt.email, cnt.phone,
              ca.address_line_1, ca.city, ca.state, ca.postal_code
       FROM clients cl
       JOIN contacts cnt ON cl.contact_id = cnt.id
       LEFT JOIN contact_addresses ca ON cnt.id = ca.contact_id AND ca.is_primary = 1
       WHERE cl.id = ?`,
      [client_id]
    );

    if (clientRows.length === 0) {
      const err = new Error("Client not found.");
      err.statusCode = 404;
      throw err;
    }
    const client = clientRows[0];

    // 2. Verify Case if provided
    if (case_id) {
      const [caseRows] = await conn.query(
        `SELECT id, primary_client_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
        [case_id]
      );
      if (caseRows.length === 0) {
        const err = new Error("Case matter not found.");
        err.statusCode = 404;
        throw err;
      }
      if (caseRows[0].primary_client_id !== parseInt(client_id, 10)) {
        const err = new Error("Case does not belong to the selected client.");
        err.statusCode = 422;
        throw err;
      }
    }

    // 3. Gather line items from linked fee entries + custom items
    const lineItemsToInsert = [];

    if (Array.isArray(fee_entry_ids) && fee_entry_ids.length > 0) {
      const [feeRows] = await conn.query(
        `SELECT * FROM fee_entries 
         WHERE id IN (?) AND client_id = ? AND deleted_at IS NULL FOR UPDATE`,
        [fee_entry_ids, client_id]
      );

      if (feeRows.length !== fee_entry_ids.length) {
        const err = new Error("One or more fee entries could not be found for this client.");
        err.statusCode = 422;
        throw err;
      }

      for (const fe of feeRows) {
        if (fe.status === "INVOICED" || fe.invoice_id) {
          const err = new Error(`Fee entry #${fe.id} has already been invoiced.`);
          err.statusCode = 409;
          throw err;
        }
        if (fe.status === "CANCELLED") {
          const err = new Error(`Cannot invoice cancelled fee entry #${fe.id}.`);
          err.statusCode = 422;
          throw err;
        }

        lineItemsToInsert.push({
          fee_entry_id: fe.id,
          description: fe.description,
          service_date: fe.service_date,
          quantity: fe.quantity,
          unit: fe.unit,
          unit_price: fe.rate,
          discount: 0,
          tax_rate: fe.is_taxable ? tax_rate : 0,
        });
      }
    }

    // Process custom items or items array
    const resolvedCustomItems = (Array.isArray(custom_items) && custom_items.length > 0)
      ? custom_items
      : (Array.isArray(invoiceData.items) ? invoiceData.items : []);

    if (resolvedCustomItems.length > 0) {
      for (const item of resolvedCustomItems) {
        if (!item.description || !item.description.trim()) {
          const err = new Error("Each line item must have a description.");
          err.statusCode = 422;
          throw err;
        }
        const qty = Math.max(0.01, roundDec2(item.quantity || 1));
        const price = Math.max(0, roundDec2(item.unit_price || item.rate || item.amount || 0));
        lineItemsToInsert.push({
          fee_entry_id: null,
          description: item.description.trim(),
          service_date: item.service_date || invoice_date,
          quantity: qty,
          unit: item.unit || "UNIT",
          unit_price: price,
          discount: roundDec2(item.discount || 0),
          tax_rate: item.is_taxable === false ? 0 : tax_rate,
        });
      }
    }

    if (lineItemsToInsert.length === 0) {
      const err = new Error("An invoice must contain at least one line item or billable fee entry.");
      err.statusCode = 422;
      throw err;
    }

    // 4. Calculate Authoritative Financial Totals
    const subtotal = calculateInvoiceSubtotal(lineItemsToInsert);
    const discountAmount = calculateDiscount(subtotal, discount_type, discount_value);
    const taxableAmount = calculateTaxableAmount(subtotal, discountAmount);

    const isInterState = place_of_supply && place_of_supply.toLowerCase() !== "tamil nadu";
    const effectiveGstMode = rcm_applicable ? "RCM" : gst_mode;
    const taxes = calculateTaxes(taxableAmount, effectiveGstMode, tax_rate, isInterState);
    const totalAmount = calculateInvoiceTotal(taxableAmount, taxes.taxAmount);
    const amountDue = calculateAmountDue(totalAmount, 0.0);

    // 5. Build Initial Billing Snapshot
    const billingName = client.display_name || "Client";
    const billingAddress = [client.address_line_1, client.city, client.state, client.postal_code]
      .filter(Boolean)
      .join(", ") || "Address not provided";
    const billingEmail = client.email || null;
    const billingPhone = client.phone || null;

    const chambersProfile = await getChambersBillingProfile(conn);
    const draftNumber = generateDraftInvoiceNumber();

    // 6. Insert Invoice Record (DRAFT)
    const [invResult] = await conn.query(
      `INSERT INTO invoices (
        invoice_number, client_id, case_id, invoice_date, due_date, status,
        subtotal, discount_type, discount_value, discount_amount, taxable_amount,
        gst_mode, tax_rate, cgst_amount, sgst_amount, igst_amount, tax_amount,
        total_amount, amount_paid, amount_due, currency,
        rcm_applicable, rcm_reason, place_of_supply, notes, terms,
        billing_name, billing_address, billing_email, billing_phone,
        advocate_business_name, advocate_address, advocate_gstin,
        created_by
      ) VALUES (
        ?, ?, ?, ?, ?, 'DRAFT',
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, 0.00, ?, 'INR',
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?
      )`,
      [
        draftNumber,
        client_id,
        case_id || null,
        resolvedInvoiceDate,
        due_date,
        subtotal,
        discount_type,
        discount_value,
        discountAmount,
        taxableAmount,
        effectiveGstMode,
        tax_rate,
        taxes.cgstAmount,
        taxes.sgstAmount,
        taxes.igstAmount,
        taxes.taxAmount,
        totalAmount,
        amountDue,
        rcm_applicable ? 1 : 0,
        rcm_reason || null,
        place_of_supply || "Tamil Nadu",
        notes || null,
        terms || null,
        billingName,
        billingAddress,
        billingEmail,
        billingPhone,
        chambersProfile.advocateBusinessName,
        chambersProfile.advocateAddress,
        chambersProfile.advocateGstin,
        userId || null,
      ]
    );

    const invoiceId = invResult.insertId;

    // 7. Insert Line Items
    for (const item of lineItemsToInsert) {
      const lineCalc = calculateLineItem(
        item.quantity,
        item.unit_price,
        item.discount,
        effectiveGstMode === "RCM" ? 0 : item.tax_rate
      );

      await conn.query(
        `INSERT INTO invoice_items (
          invoice_id, fee_entry_id, description, service_date, quantity, unit,
          unit_price, discount, taxable_amount, tax_rate, tax_amount, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.fee_entry_id || null,
          item.description,
          item.service_date,
          lineCalc.quantity,
          item.unit || "UNIT",
          lineCalc.unitPrice,
          lineCalc.discount,
          lineCalc.taxableAmount,
          lineCalc.taxRate,
          lineCalc.taxAmount,
          lineCalc.lineTotal,
        ]
      );

      // Lock linked fee entries as INVOICED
      if (item.fee_entry_id) {
        await conn.query(
          `UPDATE fee_entries SET status = 'INVOICED', invoice_id = ? WHERE id = ?`,
          [invoiceId, item.fee_entry_id]
        );
      }
    }

    // 8. Audit Event
    await logBillingEvent(
      userId,
      "INVOICE_CREATED",
      "INVOICE",
      invoiceId,
      ip,
      userAgent,
      {
        invoiceNumber: draftNumber,
        clientId: client_id,
        subtotal,
        totalAmount,
        gstMode: effectiveGstMode,
        rcmApplicable: rcm_applicable,
      },
      conn
    );

    await conn.commit();
    return getInvoiceById(invoiceId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Get full Invoice details by ID
 * @param {number} id
 * @param {number} [clientRestrictionId] - If client user, strictly enforces ownership
 * @returns {Promise<object>}
 */
const getInvoiceById = async (id, clientRestrictionId = null) => {
  let where = "inv.id = ?";
  const params = [id];

  if (clientRestrictionId) {
    where += " AND inv.client_id = ?";
    params.push(clientRestrictionId);
  }

  const [rows] = await db.execute(
    `SELECT 
      inv.*,
      cnt.display_name AS contact_name,
      cnt.email AS contact_email,
      cl.client_code,
      cs.case_number,
      cs.title AS case_title,
      cs.cnr_number,
      crt.name AS court_name,
      u_cr.first_name AS creator_first_name,
      u_cr.last_name AS creator_last_name,
      u_is.first_name AS issuer_first_name,
      u_is.last_name AS issuer_last_name
     FROM invoices inv
     JOIN clients cl ON inv.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     LEFT JOIN cases cs ON inv.case_id = cs.id
     LEFT JOIN courts crt ON cs.court_id = crt.id
     LEFT JOIN users u_cr ON inv.created_by = u_cr.id
     LEFT JOIN users u_is ON inv.issued_by = u_is.id
     WHERE ${where}`,
    params
  );

  if (rows.length === 0) {
    const err = new Error("Invoice not found or access denied.");
    err.statusCode = 404;
    throw err;
  }

  const invoice = rows[0];

  // Retrieve line items
  const [items] = await db.execute(
    `SELECT ii.*, fe.fee_type
     FROM invoice_items ii
     LEFT JOIN fee_entries fe ON ii.fee_entry_id = fe.id
     WHERE ii.invoice_id = ?
     ORDER BY ii.id ASC`,
    [id]
  );

  // Retrieve payments
  const [payments] = await db.execute(
    `SELECT p.*, u.first_name AS receiver_first_name, u.last_name AS receiver_last_name
     FROM payments p
     LEFT JOIN users u ON p.received_by = u.id
     WHERE p.invoice_id = ?
     ORDER BY p.payment_date DESC, p.id DESC`,
    [id]
  );

  // Retrieve reminders
  const [reminders] = await db.execute(
    `SELECT * FROM invoice_reminders WHERE invoice_id = ? ORDER BY scheduled_for ASC`,
    [id]
  );

  invoice.items = items;
  invoice.payments = payments;
  invoice.reminders = reminders;

  // Compute dynamic overdue status if applicable
  invoice.computedStatus = resolveInvoiceStatus(
    invoice.status,
    invoice.total_amount,
    invoice.amount_paid,
    invoice.due_date
  );

  return invoice;
};

/**
 * List invoices with filters and pagination
 * @param {object} filters
 * @param {number} [clientRestrictionId]
 * @returns {Promise<{ items: Array, pagination: object, summary: object }>}
 */
const getInvoices = async (filters = {}, clientRestrictionId = null) => {
  const {
    client_id,
    case_id,
    status,
    search,
    start_date,
    end_date,
    overdue_only,
    page = 1,
    limit = 20,
  } = filters;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const whereClauses = ["1 = 1"];
  const params = [];

  if (clientRestrictionId) {
    whereClauses.push("inv.client_id = ?");
    params.push(clientRestrictionId);
  } else if (client_id) {
    whereClauses.push("inv.client_id = ?");
    params.push(client_id);
  }

  if (case_id) {
    whereClauses.push("inv.case_id = ?");
    params.push(case_id);
  }

  if (status) {
    whereClauses.push("inv.status = ?");
    params.push(status);
  }

  if (start_date) {
    whereClauses.push("inv.invoice_date >= ?");
    params.push(start_date);
  }

  if (end_date) {
    whereClauses.push("inv.invoice_date <= ?");
    params.push(end_date);
  }

  if (overdue_only === true || overdue_only === "true") {
    const today = new Date().toISOString().split("T")[0];
    whereClauses.push("inv.due_date < ? AND inv.amount_due > 0 AND inv.status NOT IN ('CANCELLED', 'VOID', 'PAID')");
    params.push(today);
  }

  if (search && search.trim()) {
    whereClauses.push("(inv.invoice_number LIKE ? OR inv.billing_name LIKE ? OR cs.case_number LIKE ?)");
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  const whereSql = whereClauses.join(" AND ");

  // Count & financial aggregate summary
  const [countRows] = await db.execute(
    `SELECT 
       COUNT(*) AS total,
       COALESCE(SUM(inv.total_amount), 0) AS total_invoiced,
       COALESCE(SUM(inv.amount_paid), 0) AS total_collected,
       COALESCE(SUM(inv.amount_due), 0) AS total_outstanding,
       COALESCE(SUM(CASE WHEN inv.status = 'PAID' THEN 1 ELSE 0 END), 0) AS count_paid,
       COALESCE(SUM(CASE WHEN inv.status = 'PARTIALLY_PAID' THEN 1 ELSE 0 END), 0) AS count_partially_paid,
       COALESCE(SUM(CASE WHEN inv.due_date < CURRENT_DATE() AND inv.amount_due > 0 AND inv.status NOT IN ('CANCELLED', 'VOID', 'PAID') THEN inv.amount_due ELSE 0 END), 0) AS total_overdue
     FROM invoices inv
     LEFT JOIN cases cs ON inv.case_id = cs.id
     WHERE ${whereSql}`,
    params
  );

  const total = countRows[0].total;

  const [items] = await db.execute(
    `SELECT 
      inv.*,
      cl.client_code,
      cnt.display_name AS client_name,
      cs.case_number,
      cs.title AS case_title
     FROM invoices inv
     JOIN clients cl ON inv.client_id = cl.id
     JOIN contacts cnt ON cl.contact_id = cnt.id
     LEFT JOIN cases cs ON inv.case_id = cs.id
     WHERE ${whereSql}
     ORDER BY inv.invoice_date DESC, inv.id DESC
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
      totalInvoiced: roundDec2(countRows[0].total_invoiced),
      totalCollected: roundDec2(countRows[0].total_collected),
      totalOutstanding: roundDec2(countRows[0].total_outstanding),
      totalOverdue: roundDec2(countRows[0].total_overdue),
      countPaid: parseInt(countRows[0].count_paid, 10),
      countPartiallyPaid: parseInt(countRows[0].count_partially_paid, 10),
    },
  };
};

/**
 * Edit a DRAFT invoice
 * Once issued, financial values become immutable.
 * @param {number} id
 * @param {object} updateData
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const updateDraftInvoice = async (id, updateData, userId, ip = null, userAgent = null) => {
  const invoice = await getInvoiceById(id);

  if (invoice.status !== "DRAFT") {
    const err = new Error(
      `Cannot edit invoice ${invoice.invoice_number} because it is in '${invoice.status}' status. Only DRAFT invoices can be directly modified.`
    );
    err.statusCode = 422;
    throw err;
  }

  const {
    due_date = invoice.due_date,
    discount_type = invoice.discount_type,
    discount_value = invoice.discount_value,
    gst_mode = invoice.gst_mode,
    tax_rate = invoice.tax_rate,
    rcm_applicable = invoice.rcm_applicable,
    rcm_reason = invoice.rcm_reason,
    place_of_supply = invoice.place_of_supply,
    notes = invoice.notes,
    terms = invoice.terms,
    custom_items,
  } = updateData;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let itemsToProcess = invoice.items;

    // If new line items are provided, replace line items
    if (Array.isArray(custom_items) && custom_items.length > 0) {
      await conn.query(`DELETE FROM invoice_items WHERE invoice_id = ?`, [id]);
      itemsToProcess = [];

      for (const item of custom_items) {
        const qty = Math.max(0.01, roundDec2(item.quantity || 1));
        const price = Math.max(0, roundDec2(item.unit_price || item.rate || 0));
        const disc = roundDec2(item.discount || 0);

        const lineCalc = calculateLineItem(qty, price, disc, rcm_applicable ? 0 : tax_rate);
        await conn.query(
          `INSERT INTO invoice_items (
            invoice_id, fee_entry_id, description, service_date, quantity, unit,
            unit_price, discount, taxable_amount, tax_rate, tax_amount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.fee_entry_id || null,
            item.description,
            item.service_date || invoice.invoice_date,
            lineCalc.quantity,
            item.unit || "UNIT",
            lineCalc.unitPrice,
            lineCalc.discount,
            lineCalc.taxableAmount,
            lineCalc.taxRate,
            lineCalc.taxAmount,
            lineCalc.lineTotal,
          ]
        );

        itemsToProcess.push({
          quantity: lineCalc.quantity,
          unit_price: lineCalc.unitPrice,
        });
      }
    }

    const subtotal = calculateInvoiceSubtotal(itemsToProcess);
    const discountAmount = calculateDiscount(subtotal, discount_type, discount_value);
    const taxableAmount = calculateTaxableAmount(subtotal, discountAmount);
    const isInterState = place_of_supply && place_of_supply.toLowerCase() !== "tamil nadu";
    const effectiveGstMode = rcm_applicable ? "RCM" : gst_mode;
    const taxes = calculateTaxes(taxableAmount, effectiveGstMode, tax_rate, isInterState);
    const totalAmount = calculateInvoiceTotal(taxableAmount, taxes.taxAmount);
    const amountDue = calculateAmountDue(totalAmount, invoice.amount_paid);

    await conn.query(
      `UPDATE invoices SET
        due_date = ?,
        subtotal = ?,
        discount_type = ?,
        discount_value = ?,
        discount_amount = ?,
        taxable_amount = ?,
        gst_mode = ?,
        tax_rate = ?,
        cgst_amount = ?,
        sgst_amount = ?,
        igst_amount = ?,
        tax_amount = ?,
        total_amount = ?,
        amount_due = ?,
        rcm_applicable = ?,
        rcm_reason = ?,
        place_of_supply = ?,
        notes = ?,
        terms = ?
       WHERE id = ?`,
      [
        due_date,
        subtotal,
        discount_type,
        discount_value,
        discountAmount,
        taxableAmount,
        effectiveGstMode,
        tax_rate,
        taxes.cgstAmount,
        taxes.sgstAmount,
        taxes.igstAmount,
        taxes.taxAmount,
        totalAmount,
        amountDue,
        rcm_applicable ? 1 : 0,
        rcm_reason || null,
        place_of_supply || "Tamil Nadu",
        notes || null,
        terms || null,
        id,
      ]
    );

    await logBillingEvent(userId, "INVOICE_UPDATED", "INVOICE", id, ip, userAgent, {
      subtotal,
      totalAmount,
    }, conn);

    await conn.commit();
    return getInvoiceById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Issue an invoice: Locks financial amounts, creates immutable billing snapshot,
 * generates official sequential invoice number (INV-YYYY-XXXXXX).
 * @param {number} id
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const issueInvoice = async (id, userId, ip = null, userAgent = null) => {
  const invoice = await getInvoiceById(id);

  if (invoice.status !== "DRAFT") {
    const err = new Error(
      `Invoice #${id} cannot be issued because it is already in '${invoice.status}' status.`
    );
    err.statusCode = 422;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Generate sequential unique invoice number atomically under lock
    const permanentInvoiceNumber = await generateInvoiceNumber(conn, new Date(invoice.invoice_date).getFullYear());

    // 2. Lock client profile snapshot
    const [clientRows] = await conn.query(
      `SELECT cl.id, cl.client_code, cnt.display_name, cnt.email, cnt.phone,
              ca.address_line_1, ca.city, ca.state, ca.postal_code
       FROM clients cl
       JOIN contacts cnt ON cl.contact_id = cnt.id
       LEFT JOIN contact_addresses ca ON cnt.id = ca.contact_id AND ca.is_primary = 1
       WHERE cl.id = ?`,
      [invoice.client_id]
    );

    const client = clientRows[0] || {};
    const billingName = client.display_name || invoice.billing_name || "Client";
    const billingAddress = [client.address_line_1, client.city, client.state, client.postal_code]
      .filter(Boolean)
      .join(", ") || invoice.billing_address || "Address not provided";

    const chambersProfile = await getChambersBillingProfile(conn);

    // 3. Mark invoice as ISSUED with immutable snapshot
    await conn.query(
      `UPDATE invoices SET
        invoice_number = ?,
        status = 'ISSUED',
        billing_name = ?,
        billing_address = ?,
        billing_email = ?,
        billing_phone = ?,
        advocate_business_name = ?,
        advocate_address = ?,
        advocate_gstin = ?,
        issued_by = ?,
        issued_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        permanentInvoiceNumber,
        billingName,
        billingAddress,
        client.email || invoice.billing_email,
        client.phone || invoice.billing_phone,
        chambersProfile.advocateBusinessName,
        chambersProfile.advocateAddress,
        chambersProfile.advocateGstin,
        userId || null,
        id,
      ]
    );

    // 4. Audit Log
    await logBillingEvent(
      userId,
      "INVOICE_ISSUED",
      "INVOICE",
      id,
      ip,
      userAgent,
      {
        permanentInvoiceNumber,
        totalAmount: invoice.total_amount,
        issuedBy: userId,
      },
      conn
    );

    await conn.commit();
    return getInvoiceById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Send an invoice via configured channel abstraction (EMAIL, WHATSAPP, CLIENT_PORTAL)
 * @param {number} id
 * @param {string} channel
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const sendInvoice = async (id, channel = "CLIENT_PORTAL", userId, ip = null, userAgent = null) => {
  const invoice = await getInvoiceById(id);

  if (invoice.status === "DRAFT") {
    const err = new Error("Invoice must be officially ISSUED before it can be marked as SENT.");
    err.statusCode = 422;
    throw err;
  }

  if (["CANCELLED", "VOID"].includes(invoice.status)) {
    const err = new Error(`Cannot send a ${invoice.status} invoice.`);
    err.statusCode = 422;
    throw err;
  }

  // If status is ISSUED, transition to SENT
  if (invoice.status === "ISSUED") {
    await db.execute(
      `UPDATE invoices SET status = 'SENT' WHERE id = ?`,
      [id]
    );
  }

  await logBillingEvent(userId, "INVOICE_SENT", "INVOICE", id, ip, userAgent, {
    invoiceNumber: invoice.invoice_number,
    channel,
    recipient: invoice.billing_email || invoice.billing_phone,
  });

  return getInvoiceById(id);
};

/**
 * Cancel an invoice
 * If draft or uncollected issued invoice, sets CANCELLED and unlocks any linked fee entries.
 * @param {number} id
 * @param {string} reason
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const cancelInvoice = async (id, reason, userId, ip = null, userAgent = null) => {
  const invoice = await getInvoiceById(id);

  if (["CANCELLED", "VOID"].includes(invoice.status)) {
    const err = new Error(`Invoice #${id} is already ${invoice.status}.`);
    err.statusCode = 422;
    throw err;
  }

  if (invoice.amount_paid > 0) {
    const err = new Error(
      `Cannot cancel invoice ${invoice.invoice_number} because payments of ₹${invoice.amount_paid} have already been recorded. Refund or reverse payments first.`
    );
    err.statusCode = 422;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Mark invoice CANCELLED
    await conn.query(
      `UPDATE invoices SET
        status = 'CANCELLED',
        cancelled_by = ?,
        cancelled_at = CURRENT_TIMESTAMP,
        cancellation_reason = ?
       WHERE id = ?`,
      [userId || null, reason || "Cancelled by chambers administrator", id]
    );

    // 2. Revert any linked fee entries back to UNBILLED
    await conn.query(
      `UPDATE fee_entries SET status = 'UNBILLED', invoice_id = NULL WHERE invoice_id = ?`,
      [id]
    );

    // 3. Audit Event
    await logBillingEvent(userId, "INVOICE_CANCELLED", "INVOICE", id, ip, userAgent, {
      invoiceNumber: invoice.invoice_number,
      reason,
    }, conn);

    await conn.commit();
    return getInvoiceById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Void an erroneous invoice with strict audit rationale
 * @param {number} id
 * @param {string} reason
 * @param {number} userId
 * @param {string} [ip]
 * @param {string} [userAgent]
 * @returns {Promise<object>}
 */
const voidInvoice = async (id, reason, userId, ip = null, userAgent = null) => {
  if (!reason || !reason.trim()) {
    const err = new Error("A clear reason is required to void an official invoice.");
    err.statusCode = 422;
    throw err;
  }

  const invoice = await getInvoiceById(id);

  if (invoice.amount_paid > 0) {
    const err = new Error(
      `Cannot void invoice ${invoice.invoice_number} because it has recorded payments of ₹${invoice.amount_paid}. Process payment refunds first.`
    );
    err.statusCode = 422;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE invoices SET
        status = 'VOID',
        voided_by = ?,
        voided_at = CURRENT_TIMESTAMP,
        void_reason = ?
       WHERE id = ?`,
      [userId || null, reason.trim(), id]
    );

    // Revert fee entries back to UNBILLED
    await conn.query(
      `UPDATE fee_entries SET status = 'UNBILLED', invoice_id = NULL WHERE invoice_id = ?`,
      [id]
    );

    await logBillingEvent(userId, "INVOICE_VOIDED", "INVOICE", id, ip, userAgent, {
      invoiceNumber: invoice.invoice_number,
      reason,
    }, conn);

    await conn.commit();
    return getInvoiceById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  createInvoice,
  getInvoiceById,
  getInvoices,
  updateDraftInvoice,
  issueInvoice,
  sendInvoice,
  cancelInvoice,
  voidInvoice,
};
