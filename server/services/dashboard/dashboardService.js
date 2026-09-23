const pool = require("../../config/database");
const smtpTransport = require("../email/smtpTransport");

/**
 * Helper to compute period SQL conditions
 * @param {string} period - 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'custom'
 * @param {string} from - optional YYYY-MM-DD
 * @param {string} to - optional YYYY-MM-DD
 * @param {string} column - SQL column name e.g. 'created_at' or 'payment_date'
 */
const getPeriodFilter = (period = "this_month", from = null, to = null, column = "created_at") => {
  const params = [];
  let sql = "";

  switch (period) {
    case "today":
      sql = `DATE(${column}) = CURDATE()`;
      break;

    case "this_week":
      sql = `YEARWEEK(${column}, 1) = YEARWEEK(CURDATE(), 1)`;
      break;

    case "this_month":
      sql = `DATE(${column}) >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND DATE(${column}) <= LAST_DAY(CURDATE())`;
      break;

    case "last_month":
      sql = `DATE(${column}) >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND DATE(${column}) <= LAST_DAY(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`;
      break;

    case "this_quarter":
      sql = `QUARTER(${column}) = QUARTER(CURDATE()) AND YEAR(${column}) = YEAR(CURDATE())`;
      break;

    case "custom":
      if (from && to) {
        sql = `DATE(${column}) >= ? AND DATE(${column}) <= ?`;
        params.push(from, to);
      } else if (from) {
        sql = `DATE(${column}) >= ?`;
        params.push(from);
      } else if (to) {
        sql = `DATE(${column}) <= ?`;
        params.push(to);
      } else {
        sql = `DATE(${column}) >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND DATE(${column}) <= LAST_DAY(CURDATE())`;
      }
      break;

    default:
      sql = `DATE(${column}) >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND DATE(${column}) <= LAST_DAY(CURDATE())`;
  }

  return { sql, params };
};

/**
 * Real-Time Dashboard Service
 * Authoritative source of truth for Chambers analytics.
 */
class DashboardService {
  /**
   * Get Live System Connectivity & Gateway Health
   * Checks database, SMTP, and payment gateway configuration safely without revealing credentials.
   */
  static async getSystemHealth() {
    let dbStatus = "DISCONNECTED";
    let dbLatencyMs = 0;

    try {
      const start = Date.now();
      await pool.query("SELECT 1");
      dbLatencyMs = Date.now() - start;
      dbStatus = "CONNECTED";
    } catch {
      dbStatus = "ERROR";
    }

    // SMTP Health
    let smtpStatus = "NOT_CONFIGURED";
    if (smtpTransport.isConfigured()) {
      smtpStatus = "CONFIGURED";
    }

    // Payment Gateways
    const [gatewayRows] = await pool.query(
      `SELECT provider, is_active FROM payment_settings WHERE is_active = 1`
    ).catch(() => [[]]);

    const activeProviders = gatewayRows.map((r) => (r.provider || "").toUpperCase());

    const razorpayConfigured =
      Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) ||
      activeProviders.includes("RAZORPAY");

    const payuConfigured =
      Boolean(process.env.PAYU_MERCHANT_KEY && process.env.PAYU_MERCHANT_SALT) ||
      activeProviders.includes("PAYU");

    return {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      email: {
        status: smtpStatus,
        provider: "SMTP",
      },
      gateways: {
        razorpay: razorpayConfigured ? "CONFIGURED" : "NOT_CONFIGURED",
        payu: payuConfigured ? "CONFIGURED" : "NOT_CONFIGURED",
      },
    };
  }

  /**
   * Main Dashboard Summary API
   * Parallel aggregated metrics with strict server-side RBAC scoping.
   */
  static async getDashboardSummary({ user, period = "this_month", from = null, to = null }) {
    const isOwner = Boolean(user.isOwner || (user.roles && user.roles.includes("OWNER")) || (user.roles && user.roles.includes("ADMIN")));
    const isSenior = Boolean(user.roles && user.roles.includes("SENIOR_ASSOCIATE"));
    const isJunior = Boolean(!isOwner && !isSenior);
    const isClient = Boolean(user.roles && user.roles.includes("CLIENT"));

    const userPerms = user.permissions || [];
    const hasInvoiceView = isOwner || userPerms.includes("INVOICE_VIEW");
    const hasPaymentView = isOwner || userPerms.includes("PAYMENT_VIEW");
    const hasRetainerView = isOwner || userPerms.includes("RETAINER_VIEW");
    const hasWorkforceView = isOwner || userPerms.includes("WORKFORCE_VIEW");
    const hasSecurityView = isOwner || userPerms.includes("SECURITY_VIEW");

    // Scoping for cases/hearings/tasks
    let caseScopeSql = "";
    const caseScopeParams = [];
    if (isJunior && !isClient) {
      caseScopeSql = `AND EXISTS (SELECT 1 FROM case_assignments ca WHERE ca.case_id = cs.id AND ca.user_id = ? AND ca.is_active = 1)`;
      caseScopeParams.push(user.id);
    } else if (isClient) {
      caseScopeSql = `AND cs.client_id = (SELECT id FROM clients WHERE user_id = ? LIMIT 1)`;
      caseScopeParams.push(user.id);
    }

    const periodFilter = getPeriodFilter(period, from, to, "cs.created_at");

    // ==========================================
    // 1. CASES METRICS
    // ==========================================
    const casePromise = pool.query(
      `SELECT 
        COUNT(CASE WHEN cs.case_status = 'ACTIVE' THEN 1 END) AS active_cases,
        COUNT(CASE WHEN cs.case_status IN ('CLOSED', 'DISPOSED') THEN 1 END) AS closed_cases,
        COUNT(CASE WHEN ${periodFilter.sql} THEN 1 END) AS opened_in_period,
        COUNT(*) AS total_cases
       FROM cases cs
       WHERE cs.deleted_at IS NULL ${caseScopeSql}`,
      [...periodFilter.params, ...caseScopeParams]
    );

    // ==========================================
    // 2. HEARINGS METRICS
    // ==========================================
    const hearingPromise = pool.query(
      `SELECT 
        COUNT(CASE WHEN ch.hearing_date >= CURDATE() AND ch.status = 'SCHEDULED' THEN 1 END) AS upcoming_hearings,
        COUNT(CASE WHEN ch.hearing_date = CURDATE() AND ch.status = 'SCHEDULED' THEN 1 END) AS today_hearings,
        COUNT(CASE WHEN ch.hearing_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND ch.status = 'SCHEDULED' THEN 1 END) AS tomorrow_hearings,
        COUNT(CASE WHEN ch.hearing_date > CURDATE() AND ch.hearing_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND ch.status = 'SCHEDULED' THEN 1 END) AS this_week_hearings
       FROM case_hearings ch
       JOIN cases cs ON ch.case_id = cs.id
       WHERE cs.deleted_at IS NULL ${caseScopeSql}`,
      caseScopeParams
    );

    // ==========================================
    // 3. CLIENTS METRICS
    // ==========================================
    const clientPeriodFilter = getPeriodFilter(period, from, to, "cl.created_at");
    const clientPromise = isClient
      ? Promise.resolve([[{ total_clients: 1, new_clients: 0 }]])
      : pool.query(
          `SELECT 
            COUNT(CASE WHEN cl.status = 'ACTIVE' THEN 1 END) AS total_clients,
            COUNT(CASE WHEN cl.status = 'ACTIVE' AND ${clientPeriodFilter.sql} THEN 1 END) AS new_clients
           FROM clients cl
           WHERE cl.status != 'ARCHIVED'`,
          clientPeriodFilter.params
        );

    // ==========================================
    // 4. BILLING & INVOICING METRICS (RBAC Gated)
    // ==========================================
    let billingPromise = Promise.resolve(null);
    if (hasInvoiceView && !isClient) {
      const invPeriodFilter = getPeriodFilter(period, from, to, "i.invoice_date");
      billingPromise = pool.query(
        `SELECT 
          COALESCE(SUM(CASE WHEN i.status IN ('ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE') THEN i.amount_due ELSE 0 END), 0) AS total_outstanding,
          COALESCE(SUM(CASE WHEN i.due_date < CURDATE() AND i.amount_due > 0 AND i.status IN ('ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE') THEN i.amount_due ELSE 0 END), 0) AS overdue_amount,
          COUNT(CASE WHEN i.status = 'DRAFT' THEN 1 END) AS draft_invoices,
          COUNT(CASE WHEN i.status IN ('ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') THEN 1 END) AS issued_invoices,
          COUNT(CASE WHEN ${invPeriodFilter.sql} THEN 1 END) AS period_invoices_count,
          COALESCE(SUM(CASE WHEN ${invPeriodFilter.sql} THEN i.total_amount ELSE 0 END), 0) AS period_invoices_amount
         FROM invoices i`,
        [...invPeriodFilter.params, ...invPeriodFilter.params]
      );
    }

    // ==========================================
    // 5. PAYMENTS & COLLECTIONS (RBAC Gated)
    // ==========================================
    let paymentPromise = Promise.resolve(null);
    if (hasPaymentView && !isClient) {
      const payPeriodFilter = getPeriodFilter(period, from, to, "p.payment_date");
      paymentPromise = Promise.all([
        pool.query(
          `SELECT 
            COALESCE(SUM(CASE WHEN p.payment_date = CURDATE() THEN p.amount ELSE 0 END), 0) AS today_collected,
            COALESCE(SUM(CASE WHEN p.payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND p.payment_date <= LAST_DAY(CURDATE()) THEN p.amount ELSE 0 END), 0) AS this_month_collected,
            COALESCE(SUM(CASE WHEN ${payPeriodFilter.sql} THEN p.amount ELSE 0 END), 0) AS period_collected,
            COUNT(CASE WHEN ${payPeriodFilter.sql} THEN 1 END) AS period_transactions
           FROM payments p
           WHERE p.status = 'SUCCESS'`,
          [...payPeriodFilter.params, ...payPeriodFilter.params]
        ),
        pool.query(
          `SELECT p.payment_method, COALESCE(SUM(p.amount), 0) AS total_amount, COUNT(*) AS count
           FROM payments p
           WHERE p.status = 'SUCCESS' AND ${payPeriodFilter.sql}
           GROUP BY p.payment_method`,
          payPeriodFilter.params
        ),
      ]);
    }

    // ==========================================
    // 6. RETAINERS (RBAC Gated)
    // ==========================================
    let retainerPromise = Promise.resolve(null);
    if (hasRetainerView && !isClient) {
      retainerPromise = pool.query(
        `SELECT 
          COUNT(CASE WHEN r.status = 'ACTIVE' THEN 1 END) AS active_retainers,
          COALESCE(SUM(CASE WHEN r.status = 'ACTIVE' THEN r.current_balance ELSE 0 END), 0) AS total_retainer_balance,
          COUNT(CASE WHEN r.status = 'ACTIVE' AND r.current_balance < 5000 THEN 1 END) AS low_balance_retainers
         FROM retainers r`
      );
    }

    // ==========================================
    // 7. TASKS & WORKFORCE
    // ==========================================
    let taskScopeSql = "";
    const taskParams = [];
    if (isJunior && !isClient) {
      taskScopeSql = "AND wt.assigned_to = ?";
      taskParams.push(user.id);
    }

    const taskPromise = isClient
      ? Promise.resolve([[{ pending: 0, overdue: 0, due_today: 0, due_this_week: 0 }]])
      : pool.query(
          `SELECT 
            COUNT(CASE WHEN wt.status IN ('TODO', 'IN_PROGRESS') THEN 1 END) AS pending,
            COUNT(CASE WHEN wt.status IN ('TODO', 'IN_PROGRESS') AND wt.due_date < CURDATE() THEN 1 END) AS overdue,
            COUNT(CASE WHEN wt.status IN ('TODO', 'IN_PROGRESS') AND wt.due_date = CURDATE() THEN 1 END) AS due_today,
            COUNT(CASE WHEN wt.status IN ('TODO', 'IN_PROGRESS') AND wt.due_date > CURDATE() AND wt.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 END) AS due_this_week
           FROM workforce_tasks wt
           WHERE 1=1 ${taskScopeSql}`,
          taskParams
        );

    // ==========================================
    // 8. FOLLOW-UPS & APPOINTMENTS
    // ==========================================
    const followUpPromise = isClient
      ? Promise.resolve([[{ due_today: 0, overdue: 0, upcoming: 0 }]])
      : pool.query(
          `SELECT 
            COUNT(CASE WHEN f.status = 'PENDING' AND DATE(f.scheduled_for) = CURDATE() THEN 1 END) AS due_today,
            COUNT(CASE WHEN f.status = 'PENDING' AND DATE(f.scheduled_for) < CURDATE() THEN 1 END) AS overdue,
            COUNT(CASE WHEN f.status = 'PENDING' AND DATE(f.scheduled_for) > CURDATE() THEN 1 END) AS upcoming
           FROM follow_ups f`
        );

    const appointmentPromise = pool.query(
      `SELECT 
        COUNT(CASE WHEN a.appointment_date = CURDATE() AND a.status = 'SCHEDULED' THEN 1 END) AS today_appointments,
        COUNT(CASE WHEN a.appointment_date > CURDATE() AND a.status = 'SCHEDULED' THEN 1 END) AS upcoming_appointments,
        COUNT(CASE WHEN a.appointment_date = CURDATE() AND a.status = 'COMPLETED' THEN 1 END) AS completed_today,
        COUNT(CASE WHEN a.appointment_date = CURDATE() AND a.status = 'CANCELLED' THEN 1 END) AS cancelled_today
       FROM appointments a`
    );

    // ==========================================
    // 9. LEADS / CRM PIPELINE
    // ==========================================
    const leadPromise = isClient
      ? Promise.resolve([[{ total_leads: 0, new_inquiries: 0, consultations_scheduled: 0, consultations_done: 0, retained: 0, not_converted: 0 }]])
      : pool.query(
          `SELECT 
            COUNT(*) AS total_leads,
            COUNT(CASE WHEN l.status = 'INQUIRY' THEN 1 END) AS new_inquiries,
            COUNT(CASE WHEN l.status = 'CONSULTATION_SCHEDULED' THEN 1 END) AS consultations_scheduled,
            COUNT(CASE WHEN l.status = 'CONSULTATION_DONE' THEN 1 END) AS consultations_done,
            COUNT(CASE WHEN l.status = 'RETAINED' THEN 1 END) AS retained,
            COUNT(CASE WHEN l.status = 'NOT_CONVERTED' THEN 1 END) AS not_converted
           FROM leads l`
        );

    // ==========================================
    // 10. WORKFORCE ROSTER (RBAC Gated)
    // ==========================================
    let workforcePromise = Promise.resolve(null);
    if (hasWorkforceView && !isClient) {
      workforcePromise = pool.query(
        `SELECT 
          COUNT(CASE WHEN wp.workforce_type = 'EMPLOYEE' AND wp.status = 'ACTIVE' THEN 1 END) AS active_employees,
          COUNT(CASE WHEN wp.workforce_type IN ('INTERN', 'GRADUATE_INTERN') AND wp.status = 'ACTIVE' THEN 1 END) AS active_interns,
          COUNT(CASE WHEN wp.workforce_type IN ('INTERN', 'GRADUATE_INTERN') AND wp.status = 'ACTIVE' AND ir.stipend_enabled = 1 THEN 1 END) AS paid_interns,
          COUNT(CASE WHEN wp.workforce_type IN ('INTERN', 'GRADUATE_INTERN') AND wp.status = 'ACTIVE' AND (ir.stipend_enabled = 0 OR ir.stipend_enabled IS NULL) THEN 1 END) AS unpaid_interns
         FROM workforce_profiles wp
         LEFT JOIN internship_records ir ON wp.id = ir.workforce_id`
      );
    }

    // ==========================================
    // 11. DOCUMENTS
    // ==========================================
    const docScopeSql = isClient
      ? `AND d.client_id = (SELECT id FROM clients WHERE user_id = ? LIMIT 1)`
      : "";
    const docScopeParams = isClient ? [user.id] : [];

    const docPromise = pool.query(
      `SELECT 
        COUNT(*) AS total_documents,
        COUNT(CASE WHEN d.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 END) AS added_this_month,
        COUNT(CASE WHEN d.status = 'IN_REVIEW' THEN 1 END) AS awaiting_approval,
        COUNT(CASE WHEN d.status IN ('READY_FOR_SIGNATURE', 'SIGNATURE_PENDING') THEN 1 END) AS awaiting_signature
       FROM documents d
       WHERE d.deleted_at IS NULL ${docScopeSql}`,
      docScopeParams
    );

    // ==========================================
    // 12. SYSTEM HEALTH (RBAC Gated)
    // ==========================================
    const healthPromise = hasSecurityView && !isClient
      ? DashboardService.getSystemHealth()
      : Promise.resolve(null);

    // ==========================================
    // 13. WHATSAPP HEARING REMINDERS (Real DB Aggregations)
    // ==========================================
    const reminderPromise = !isClient
      ? pool.query(`
          SELECT 
            SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) as scheduled_count,
            SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent_count,
            SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_count,
            SUM(CASE WHEN status = 'READ' THEN 1 ELSE 0 END) as read_count,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count
          FROM hearing_reminders
        `)
      : Promise.resolve([[]]);

    // Execute all queries in parallel
    const [
      [caseRows],
      [hearingRows],
      [clientRows],
      billingRes,
      paymentRes,
      retainerRes,
      [taskRows],
      [followUpRows],
      [appointmentRows],
      [leadRows],
      workforceRes,
      [docRows],
      systemHealth,
      [reminderRows],
    ] = await Promise.all([
      casePromise,
      hearingPromise,
      clientPromise,
      billingPromise,
      paymentPromise,
      retainerPromise,
      taskPromise,
      followUpPromise,
      appointmentPromise,
      leadPromise,
      workforcePromise,
      docPromise,
      healthPromise,
      reminderPromise,
    ]);

    // Format final response safely
    const response = {
      period: {
        code: period,
        from,
        to,
      },
      cases: {
        active: caseRows[0]?.active_cases || 0,
        closed: caseRows[0]?.closed_cases || 0,
        openedInPeriod: caseRows[0]?.opened_in_period || 0,
        total: caseRows[0]?.total_cases || 0,
      },
      hearings: {
        upcoming: hearingRows[0]?.upcoming_hearings || 0,
        today: hearingRows[0]?.today_hearings || 0,
        tomorrow: hearingRows[0]?.tomorrow_hearings || 0,
        thisWeek: hearingRows[0]?.this_week_hearings || 0,
      },
      clients: {
        total: clientRows[0]?.total_clients || 0,
        newInPeriod: clientRows[0]?.new_clients || 0,
      },
      tasks: {
        pending: taskRows[0]?.pending || 0,
        overdue: taskRows[0]?.overdue || 0,
        dueToday: taskRows[0]?.due_today || 0,
        dueThisWeek: taskRows[0]?.due_this_week || 0,
      },
      followups: {
        dueToday: followUpRows[0]?.due_today || 0,
        overdue: followUpRows[0]?.overdue || 0,
        upcoming: followUpRows[0]?.upcoming || 0,
      },
      appointments: {
        today: appointmentRows[0]?.today_appointments || 0,
        upcoming: appointmentRows[0]?.upcoming_appointments || 0,
        completedToday: appointmentRows[0]?.completed_today || 0,
        cancelledToday: appointmentRows[0]?.cancelled_today || 0,
      },
      leads: {
        total: leadRows[0]?.total_leads || 0,
        newInquiries: leadRows[0]?.new_inquiries || 0,
        consultationsScheduled: leadRows[0]?.consultations_scheduled || 0,
        consultationsDone: leadRows[0]?.consultations_done || 0,
        retained: leadRows[0]?.retained || 0,
        notConverted: leadRows[0]?.not_converted || 0,
      },
      documents: {
        total: docRows[0]?.total_documents || 0,
        addedThisMonth: docRows[0]?.added_this_month || 0,
        awaitingApproval: docRows[0]?.awaiting_approval || 0,
        awaitingSignature: docRows[0]?.awaiting_signature || 0,
      },
    };

    // Attach Financial Data only if authorized
    if (billingRes && billingRes[0]) {
      const b = billingRes[0][0];
      response.billing = {
        totalOutstanding: parseFloat(b?.total_outstanding) || 0,
        overdueAmount: parseFloat(b?.overdue_amount) || 0,
        draftInvoices: b?.draft_invoices || 0,
        issuedInvoices: b?.issued_invoices || 0,
        periodInvoicesCount: b?.period_invoices_count || 0,
        periodInvoicesAmount: parseFloat(b?.period_invoices_amount) || 0,
      };
    }

    if (paymentRes) {
      const [payRows] = paymentRes[0];
      const [modeRows] = paymentRes[1];
      const p = payRows[0];

      const breakdown = {};
      (modeRows || []).forEach((m) => {
        breakdown[m.payment_method] = {
          amount: parseFloat(m.total_amount) || 0,
          count: m.count || 0,
        };
      });

      response.payments = {
        todayCollected: parseFloat(p?.today_collected) || 0,
        thisMonthCollected: parseFloat(p?.this_month_collected) || 0,
        periodCollected: parseFloat(p?.period_collected) || 0,
        periodTransactions: p?.period_transactions || 0,
        breakdown,
      };
    }

    if (retainerRes && retainerRes[0]) {
      const r = retainerRes[0][0];
      response.retainers = {
        activeRetainers: r?.active_retainers || 0,
        totalBalance: parseFloat(r?.total_retainer_balance) || 0,
        lowBalanceCount: r?.low_balance_retainers || 0,
      };
    }

    // Attach Workforce if authorized
    if (workforceRes && workforceRes[0]) {
      const w = workforceRes[0][0];
      response.workforce = {
        activeEmployees: w?.active_employees || 0,
        activeInterns: w?.active_interns || 0,
        paidInterns: w?.paid_interns || 0,
        unpaidInterns: w?.unpaid_interns || 0,
      };
    }

    // Attach System Health if authorized
    if (systemHealth) {
      response.systemHealth = systemHealth;
    }

    // Attach WhatsApp Hearing Reminders (Real MySQL aggregates)
    if (reminderRows && reminderRows[0]) {
      const rem = reminderRows[0];
      response.whatsappReminders = {
        scheduled: parseInt(rem?.scheduled_count, 10) || 0,
        sent: parseInt(rem?.sent_count, 10) || 0,
        delivered: parseInt(rem?.delivered_count, 10) || 0,
        read: parseInt(rem?.read_count, 10) || 0,
        failed: parseInt(rem?.failed_count, 10) || 0,
      };
    } else {
      response.whatsappReminders = {
        scheduled: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      };
    }

    return response;
  }

  /**
   * Upcoming Hearings Widget
   */
  static async getUpcomingHearings({ user, limit = 5 }) {
    const isOwner = Boolean(user.isOwner || (user.roles && user.roles.includes("OWNER")) || (user.roles && user.roles.includes("ADMIN")));
    const isSenior = Boolean(user.roles && user.roles.includes("SENIOR_ASSOCIATE"));
    const isClient = Boolean(user.roles && user.roles.includes("CLIENT"));

    let caseScope = "";
    const params = [];

    if (!isOwner && !isSenior && !isClient) {
      caseScope = `AND EXISTS (SELECT 1 FROM case_assignments ca WHERE ca.case_id = cs.id AND ca.user_id = ? AND ca.is_active = 1)`;
      params.push(user.id);
    } else if (isClient) {
      caseScope = `AND cs.client_id = (SELECT id FROM clients WHERE user_id = ? LIMIT 1)`;
      params.push(user.id);
    }

    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 5, 50));
    params.push(safeLimit);

    const [rows] = await pool.query(
      `SELECT 
        ch.id,
        ch.hearing_date,
        ch.hearing_time,
        ch.courtroom,
        ch.purpose,
        ch.status,
        cs.id AS case_id,
        cs.case_number,
        cs.title AS case_title,
        crt.name AS court_name
       FROM case_hearings ch
       JOIN cases cs ON ch.case_id = cs.id
       LEFT JOIN courts crt ON cs.court_id = crt.id
       WHERE cs.deleted_at IS NULL 
         AND ch.hearing_date >= CURDATE()
         AND ch.status = 'SCHEDULED'
         ${caseScope}
       ORDER BY ch.hearing_date ASC, ch.hearing_time ASC
       LIMIT ?`,
      params
    );

    return rows.map((r) => ({
      id: r.id,
      hearingDate: r.hearing_date,
      hearingTime: r.hearing_time,
      courtRoom: r.courtroom,
      purpose: r.purpose,
      status: r.status,
      caseId: r.case_id,
      caseNumber: r.case_number,
      caseTitle: r.case_title,
      courtName: r.court_name,
    }));
  }

  /**
   * Upcoming Tasks Widget
   */
  static async getUpcomingTasks({ user, limit = 5 }) {
    const isOwner = Boolean(user.isOwner || (user.roles && user.roles.includes("OWNER")) || (user.roles && user.roles.includes("ADMIN")));
    const isSenior = Boolean(user.roles && user.roles.includes("SENIOR_ASSOCIATE"));

    let taskScope = "";
    const params = [];

    if (!isOwner && !isSenior) {
      taskScope = `AND wt.assigned_to = ?`;
      params.push(user.id);
    }

    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 5, 50));
    params.push(safeLimit);

    const [rows] = await pool.query(
      `SELECT 
        wt.id,
        wt.task_code,
        wt.title,
        wt.priority,
        wt.status,
        wt.due_date,
        u.first_name AS assignee_first_name,
        u.last_name AS assignee_last_name,
        cs.case_number,
        cs.title AS case_title,
        cnt.display_name AS client_name
       FROM workforce_tasks wt
       LEFT JOIN users u ON wt.assigned_to = u.id
       LEFT JOIN cases cs ON wt.related_case_id = cs.id
       LEFT JOIN clients cl ON wt.related_client_id = cl.id
       LEFT JOIN contacts cnt ON cl.contact_id = cnt.id
       WHERE wt.status IN ('TODO', 'IN_PROGRESS')
         ${taskScope}
       ORDER BY wt.due_date ASC, 
         CASE wt.priority 
           WHEN 'URGENT' THEN 1 
           WHEN 'HIGH' THEN 2 
           WHEN 'MEDIUM' THEN 3 
           WHEN 'LOW' THEN 4 
           ELSE 5 
         END ASC
       LIMIT ?`,
      params
    );

    return rows.map((r) => ({
      id: r.id,
      taskCode: r.task_code,
      title: r.title,
      priority: r.priority,
      status: r.status,
      dueDate: r.due_date,
      assignedTo: r.assignee_first_name ? `${r.assignee_first_name} ${r.assignee_last_name || ""}`.trim() : null,
      caseNumber: r.case_number,
      caseTitle: r.case_title,
      clientName: r.client_name,
    }));
  }

  /**
   * Recent Invoices Widget
   */
  static async getRecentInvoices({ user, limit = 5 }) {
    const isClient = Boolean(user.roles && user.roles.includes("CLIENT"));
    let scopeSql = "";
    const params = [];

    if (isClient) {
      scopeSql = `WHERE i.client_id = (SELECT id FROM clients WHERE user_id = ? LIMIT 1)`;
      params.push(user.id);
    }

    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 5, 50));
    params.push(safeLimit);

    const [rows] = await pool.query(
      `SELECT 
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.total_amount,
        i.amount_paid,
        i.amount_due,
        i.status,
        cnt.display_name AS client_name,
        cs.case_number
       FROM invoices i
       JOIN clients cl ON i.client_id = cl.id
       JOIN contacts cnt ON cl.contact_id = cnt.id
       LEFT JOIN cases cs ON i.case_id = cs.id
       ${scopeSql}
       ORDER BY i.created_at DESC
       LIMIT ?`,
      params
    );

    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      invoiceDate: r.invoice_date,
      dueDate: r.due_date,
      totalAmount: parseFloat(r.total_amount) || 0,
      amountPaid: parseFloat(r.amount_paid) || 0,
      amountDue: parseFloat(r.amount_due) || 0,
      status: r.status,
      clientName: r.client_name,
      caseNumber: r.case_number,
    }));
  }

  /**
   * Recent Payments Widget
   */
  static async getRecentPayments({ user, limit = 5 }) {
    const isClient = Boolean(user.roles && user.roles.includes("CLIENT"));
    let scopeSql = "";
    const params = [];

    if (isClient) {
      scopeSql = `AND i.client_id = (SELECT id FROM clients WHERE user_id = ? LIMIT 1)`;
      params.push(user.id);
    }

    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 5, 50));
    params.push(safeLimit);

    const [rows] = await pool.query(
      `SELECT 
        p.id,
        p.receipt_number,
        p.amount,
        p.payment_method,
        p.payment_date,
        p.reference_number,
        p.status,
        i.invoice_number,
        cnt.display_name AS client_name
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       JOIN clients cl ON i.client_id = cl.id
       JOIN contacts cnt ON cl.contact_id = cnt.id
       WHERE p.status = 'SUCCESS'
         ${scopeSql}
       ORDER BY p.payment_date DESC, p.created_at DESC
       LIMIT ?`,
      params
    );

    return rows.map((r) => ({
      id: r.id,
      receiptNumber: r.receipt_number,
      amount: parseFloat(r.amount) || 0,
      paymentMethod: r.payment_method,
      paymentDate: r.payment_date,
      referenceNumber: r.reference_number,
      status: r.status,
      invoiceNumber: r.invoice_number,
      clientName: r.client_name,
    }));
  }

  /**
   * Real Recent Activity Feed
   * Merges audit records from CRM, Billing, and Auth while sanitizing sensitive details.
   */
  static async getRecentActivity({ user, limit = 10 }) {
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 10, 50));

    const [rows] = await pool.query(
      `(
        SELECT 
          'CRM' AS source,
          cal.action AS event_name,
          cal.entity_type,
          cal.entity_id,
          cal.created_at,
          u.first_name,
          u.last_name
        FROM crm_audit_logs cal
        LEFT JOIN users u ON cal.user_id = u.id
        ORDER BY cal.created_at DESC
        LIMIT 20
      )
      UNION ALL
      (
        SELECT 
          'BILLING' AS source,
          bal.event AS event_name,
          bal.entity_type,
          bal.entity_id,
          bal.created_at,
          u.first_name,
          u.last_name
        FROM billing_audit_logs bal
        LEFT JOIN users u ON bal.user_id = u.id
        ORDER BY bal.created_at DESC
        LIMIT 20
      )
      ORDER BY created_at DESC
      LIMIT ?`,
      [safeLimit]
    );

    return rows.map((r) => {
      const userName = r.first_name ? `${r.first_name} ${r.last_name || ""}`.trim() : "System";
      return {
        source: r.source,
        action: r.event_name,
        entityType: r.entity_type,
        entityId: r.entity_id,
        performedBy: userName,
        timestamp: r.created_at,
      };
    });
  }

  /**
   * Dedicated Client Portal Dashboard
   */
  static async getClientDashboardView({ user }) {
    const [clientRow] = await pool.query(
      `SELECT cl.id, cl.client_code, cnt.display_name, cnt.email, cnt.phone
       FROM clients cl
       JOIN contacts cnt ON cl.contact_id = cnt.id
       WHERE cl.user_id = ?
       LIMIT 1`,
      [user.id]
    );

    const client = clientRow[0];
    if (!client) {
      return {
        clientInfo: null,
        cases: [],
        hearings: [],
        invoices: [],
        payments: [],
        totalDue: 0,
      };
    }

    const clientId = client.id;

    // Client's active cases
    const [cases] = await pool.query(
      `SELECT cs.id, cs.case_number, cs.title, cs.case_status, cs.case_stage, crt.name AS court_name
       FROM cases cs
       LEFT JOIN courts crt ON cs.court_id = crt.id
       WHERE cs.client_id = ? AND cs.deleted_at IS NULL
       ORDER BY cs.created_at DESC`,
      [clientId]
    );

    // Client's upcoming hearings
    const [hearings] = await pool.query(
      `SELECT ch.id, ch.hearing_date, ch.hearing_time, ch.purpose, cs.case_number, crt.name AS court_name
       FROM case_hearings ch
       JOIN cases cs ON ch.case_id = cs.id
       LEFT JOIN courts crt ON cs.court_id = crt.id
       WHERE cs.client_id = ? AND ch.hearing_date >= CURDATE() AND ch.status = 'SCHEDULED'
       ORDER BY ch.hearing_date ASC
       LIMIT 10`,
      [clientId]
    );

    // Client's invoices
    const [invoices] = await pool.query(
      `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.total_amount, i.amount_paid, i.amount_due, i.status
       FROM invoices i
       WHERE i.client_id = ? AND i.status != 'DRAFT'
       ORDER BY i.invoice_date DESC
       LIMIT 10`,
      [clientId]
    );

    // Total Due
    const [dueRows] = await pool.query(
      `SELECT COALESCE(SUM(amount_due), 0) AS total_due
       FROM invoices
       WHERE client_id = ? AND status IN ('ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')`,
      [clientId]
    );

    return {
      clientInfo: client,
      cases,
      hearings,
      invoices: invoices.map((inv) => ({
        ...inv,
        totalAmount: parseFloat(inv.total_amount) || 0,
        amountPaid: parseFloat(inv.amount_paid) || 0,
        amountDue: parseFloat(inv.amount_due) || 0,
      })),
      totalDue: parseFloat(dueRows[0]?.total_due) || 0,
    };
  }
}

module.exports = DashboardService;
