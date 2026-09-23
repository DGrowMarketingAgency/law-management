const db = require("../config/database");
const { logCaseEvent } = require("./auditService");
const { updateNextHearingDate } = require("./caseDateService");

const ALLOWED_CASE_STAGES = [
  "NEW",
  "FILED",
  "ADMITTED",
  "NOTICE",
  "PLEADINGS",
  "EVIDENCE",
  "ARGUMENTS",
  "JUDGMENT",
  "ORDER",
  "APPEAL",
  "EXECUTION",
  "CLOSED",
];

const ALLOWED_CASE_STATUSES = [
  "ACTIVE",
  "STAYED",
  "CLOSED",
  "DISPOSED",
  "TRANSFERRED",
  "WITHDRAWN",
];

/**
 * List cases with parameterized filters, search, pagination, and user authorization scoping
 */
const getCases = async ({
  page = 1,
  limit = 20,
  search = "",
  cnr_number = "",
  case_number = "",
  client_id = "",
  court_id = "",
  case_type = "",
  case_stage = "",
  case_status = "",
  assigned_user_id = "",
  has_upcoming_hearing = "",
  userId = null,
  isOwner = false,
  isSenior = false,
} = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const whereClauses = ["cs.deleted_at IS NULL"];
  const params = [];

  // Two-Layer Scope: If Junior Associate, must be assigned to case
  if (!isOwner && !isSenior && userId) {
    whereClauses.push(
      `EXISTS (SELECT 1 FROM case_assignments ca_user WHERE ca_user.case_id = cs.id AND ca_user.user_id = ? AND ca_user.is_active = 1)`
    );
    params.push(userId);
  }

  if (search) {
    whereClauses.push(
      "(cs.case_number LIKE ? OR cs.cnr_number LIKE ? OR cs.title LIKE ? OR cl_cnt.display_name LIKE ?)"
    );
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (cnr_number) {
    whereClauses.push("cs.cnr_number = ?");
    params.push(cnr_number.trim());
  }

  if (case_number) {
    whereClauses.push("cs.case_number LIKE ?");
    params.push(`%${case_number.trim()}%`);
  }

  if (client_id) {
    whereClauses.push("cs.primary_client_id = ?");
    params.push(client_id);
  }

  if (court_id) {
    whereClauses.push("cs.court_id = ?");
    params.push(court_id);
  }

  if (case_type) {
    whereClauses.push("cs.case_type = ?");
    params.push(case_type.trim());
  }

  if (case_stage && ALLOWED_CASE_STAGES.includes(case_stage)) {
    whereClauses.push("cs.case_stage = ?");
    params.push(case_stage);
  }

  if (case_status && ALLOWED_CASE_STATUSES.includes(case_status)) {
    whereClauses.push("cs.case_status = ?");
    params.push(case_status);
  }

  if (assigned_user_id) {
    whereClauses.push(
      `EXISTS (SELECT 1 FROM case_assignments ca_flt WHERE ca_flt.case_id = cs.id AND ca_flt.user_id = ? AND ca_flt.is_active = 1)`
    );
    params.push(assigned_user_id);
  }

  if (has_upcoming_hearing === "true" || has_upcoming_hearing === true) {
    whereClauses.push("cs.next_hearing_date IS NOT NULL AND cs.next_hearing_date >= CURDATE()");
  } else if (has_upcoming_hearing === "false" || has_upcoming_hearing === false) {
    whereClauses.push("(cs.next_hearing_date IS NULL OR cs.next_hearing_date < CURDATE())");
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  // Count query
  const countQuery = `
    SELECT COUNT(*) as total 
    FROM cases cs
    JOIN clients cl ON cs.primary_client_id = cl.id
    JOIN contacts cl_cnt ON cl.contact_id = cl_cnt.id
    JOIN courts crt ON cs.court_id = crt.id
    ${whereSql}
  `;
  const [countRows] = await db.execute(countQuery, params);
  const total = countRows[0]?.total || 0;
  const total_pages = Math.ceil(total / safeLimit);

  // Data query
  const dataQuery = `
    SELECT 
      cs.*,
      crt.name as court_name, crt.court_type, crt.city as court_city,
      cl.client_code, cl_cnt.id as contact_id, cl_cnt.display_name as client_name, cl_cnt.phone as client_phone, cl_cnt.email as client_email
    FROM cases cs
    JOIN clients cl ON cs.primary_client_id = cl.id
    JOIN contacts cl_cnt ON cl.contact_id = cl_cnt.id
    JOIN courts crt ON cs.court_id = crt.id
    ${whereSql}
    ORDER BY (cs.next_hearing_date IS NULL) ASC, cs.next_hearing_date ASC, cs.updated_at DESC
    LIMIT ${safeLimit} OFFSET ${offset}
  `;

  const [rows] = await db.execute(dataQuery, params);

  // Fetch active assigned users for each case
  const caseIds = rows.map((r) => r.id);
  let assignmentsMap = {};
  if (caseIds.length > 0) {
    const placeholders = caseIds.map(() => "?").join(",");
    const [assignRows] = await db.execute(
      `SELECT ca.case_id, ca.user_id, ca.role_in_case, u.first_name, u.last_name
       FROM case_assignments ca
       JOIN users u ON ca.user_id = u.id
       WHERE ca.case_id IN (${placeholders}) AND ca.is_active = 1`,
      caseIds
    );
    assignRows.forEach((a) => {
      if (!assignmentsMap[a.case_id]) assignmentsMap[a.case_id] = [];
      assignmentsMap[a.case_id].push({
        userId: a.user_id,
        name: `${a.first_name} ${a.last_name}`,
        roleInCase: a.role_in_case,
      });
    });
  }

  return {
    items: rows.map((r) => ({
      id: r.id,
      caseNumber: r.case_number,
      cnrNumber: r.cnr_number,
      title: r.title,
      caseType: r.case_type,
      caseStage: r.case_stage,
      caseStatus: r.case_status,
      filingDate: r.filing_date,
      registrationDate: r.registration_date,
      nextHearingDate: r.next_hearing_date,
      court: {
        id: r.court_id,
        name: r.court_name,
        courtType: r.court_type,
        city: r.court_city,
      },
      client: {
        id: r.primary_client_id,
        clientCode: r.client_code,
        name: r.client_name,
        phone: r.client_phone,
        email: r.client_email,
      },
      assignedUsers: assignmentsMap[r.id] || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      total_pages,
    },
  };
};

/**
 * Get single Case Dossier by ID
 */
const getCaseById = async (id) => {
  const query = `
    SELECT 
      cs.*,
      crt.name as court_name, crt.court_type, crt.city as court_city, crt.state as court_state, crt.address as court_address,
      cl.client_code, cl.status as client_status,
      cl_cnt.id as contact_id, cl_cnt.display_name as client_name, cl_cnt.phone as client_phone, cl_cnt.email as client_email, cl_cnt.organization_name as client_org
    FROM cases cs
    JOIN clients cl ON cs.primary_client_id = cl.id
    JOIN contacts cl_cnt ON cl.contact_id = cl_cnt.id
    JOIN courts crt ON cs.court_id = crt.id
    WHERE cs.id = ? AND cs.deleted_at IS NULL
    LIMIT 1
  `;

  const [rows] = await db.execute(query, [id]);
  if (!rows || rows.length === 0) {
    const err = new Error("Case file not found or has been archived.");
    err.statusCode = 404;
    err.code = "CASE_NOT_FOUND";
    throw err;
  }

  const r = rows[0];

  // Parties
  const [parties] = await db.execute(
    `SELECT cp.*, c.display_name, c.phone, c.email, c.organization_name
     FROM case_parties cp
     JOIN contacts c ON cp.contact_id = c.id
     WHERE cp.case_id = ?
     ORDER BY cp.is_primary DESC, cp.id ASC`,
    [id]
  );

  // Counsel
  const [counsel] = await db.execute(
    `SELECT ccsl.*, c.display_name, c.phone, c.email, c.organization_name
     FROM case_counsel ccsl
     JOIN contacts c ON ccsl.contact_id = c.id
     WHERE ccsl.case_id = ?
     ORDER BY ccsl.id ASC`,
    [id]
  );

  // Assigned Advocates
  const [assignments] = await db.execute(
    `SELECT ca.*, u.first_name, u.last_name, u.email, assigner.first_name as assigner_first, assigner.last_name as assigner_last
     FROM case_assignments ca
     JOIN users u ON ca.user_id = u.id
     LEFT JOIN users assigner ON ca.assigned_by = assigner.id
     WHERE ca.case_id = ? AND ca.is_active = 1
     ORDER BY ca.created_at ASC`,
    [id]
  );

  return {
    id: r.id,
    caseNumber: r.case_number,
    cnrNumber: r.cnr_number,
    title: r.title,
    caseType: r.case_type,
    caseStage: r.case_stage,
    caseStatus: r.case_status,
    description: r.description,
    filingDate: r.filing_date,
    registrationDate: r.registration_date,
    nextHearingDate: r.next_hearing_date,
    source: r.source,
    court: {
      id: r.court_id,
      name: r.court_name,
      courtType: r.court_type,
      city: r.court_city,
      state: r.court_state,
      address: r.court_address,
    },
    client: {
      id: r.primary_client_id,
      clientCode: r.client_code,
      name: r.client_name,
      phone: r.client_phone,
      email: r.client_email,
      organization: r.client_org,
      status: r.client_status,
    },
    parties: parties.map((p) => ({
      id: p.id,
      contactId: p.contact_id,
      displayName: p.display_name,
      partyRole: p.party_role,
      partyDescription: p.party_description,
      isPrimary: Boolean(p.is_primary),
      phone: p.phone,
      email: p.email,
    })),
    counsel: counsel.map((c) => ({
      id: c.id,
      contactId: c.contact_id,
      displayName: c.display_name,
      counselType: c.counsel_type,
      notes: c.notes,
      phone: c.phone,
      email: c.email,
    })),
    assignments: assignments.map((a) => ({
      id: a.id,
      userId: a.user_id,
      name: `${a.first_name} ${a.last_name}`,
      email: a.email,
      roleInCase: a.role_in_case,
      assignedBy: a.assigner_first ? `${a.assigner_first} ${a.assigner_last}` : "Chambers",
      createdAt: a.created_at,
    })),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

/**
 * Create Case with transactional integrity
 */
const createCase = async (data, creatorId = null, ip = null, userAgent = null) => {
  const {
    case_number,
    cnr_number,
    court_id,
    case_type,
    case_stage,
    case_status,
    title,
    filing_date,
    registration_date,
    description,
    primary_client_id,
    assigned_user_ids = [],
  } = data;

  // Validation
  if (!case_number || !court_id || !case_type || !title || !primary_client_id) {
    const err = new Error("Case number, court, case type, title, and primary client are required.");
    err.statusCode = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const cleanStage = case_stage || "NEW";
  if (!ALLOWED_CASE_STAGES.includes(cleanStage)) {
    const err = new Error(`Invalid case_stage: ${cleanStage}`);
    err.statusCode = 422;
    err.code = "INVALID_STAGE";
    throw err;
  }

  const cleanStatus = case_status || "ACTIVE";
  if (!ALLOWED_CASE_STATUSES.includes(cleanStatus)) {
    const err = new Error(`Invalid case_status: ${cleanStatus}`);
    err.statusCode = 422;
    err.code = "INVALID_STATUS";
    throw err;
  }

  const cleanCNR = cnr_number ? String(cnr_number).trim().toUpperCase() : null;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verify Court Exists
    const [courtRows] = await connection.execute(
      `SELECT id FROM courts WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [court_id]
    );
    if (courtRows.length === 0) {
      const err = new Error("Specified Court does not exist or has been removed.");
      err.statusCode = 422;
      err.code = "COURT_NOT_FOUND";
      throw err;
    }

    // 2. Verify Primary Client Exists
    const [clientRows] = await connection.execute(
      `SELECT id FROM clients WHERE id = ? LIMIT 1`,
      [primary_client_id]
    );
    if (clientRows.length === 0) {
      const err = new Error("Primary Client does not exist. Please onboard client in CRM first.");
      err.statusCode = 422;
      err.code = "CLIENT_NOT_FOUND";
      throw err;
    }

    // 3. Verify CNR Uniqueness (if provided)
    if (cleanCNR) {
      const [existingCNR] = await connection.execute(
        `SELECT id FROM cases WHERE cnr_number = ? AND deleted_at IS NULL LIMIT 1`,
        [cleanCNR]
      );
      if (existingCNR.length > 0) {
        const err = new Error("A case with this CNR number already exists.");
        err.statusCode = 409;
        err.code = "DUPLICATE_CNR";
        throw err;
      }
    }

    // 4. Insert Case
    const insertSql = `
      INSERT INTO cases (
        case_number, cnr_number, court_id, case_type, case_stage, case_status,
        title, filing_date, registration_date, description, primary_client_id,
        source, created_by, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?, ?)
    `;

    const [res] = await connection.execute(insertSql, [
      String(case_number).trim(),
      cleanCNR,
      court_id,
      String(case_type).trim(),
      cleanStage,
      cleanStatus,
      String(title).trim(),
      filing_date ? new Date(filing_date) : null,
      registration_date ? new Date(registration_date) : null,
      description ? String(description).trim() : null,
      primary_client_id,
      creatorId,
      creatorId,
    ]);

    const caseId = res.insertId;

    // 5. Initial Advocate Assignments
    const usersToAssign = Array.isArray(assigned_user_ids) ? assigned_user_ids : [assigned_user_ids].filter(Boolean);
    for (const uid of usersToAssign) {
      await connection.execute(
        `INSERT INTO case_assignments (case_id, user_id, role_in_case, assigned_by, is_active)
         VALUES (?, ?, 'ASSIGNED_ASSOCIATE', ?, 1)`,
        [caseId, uid, creatorId]
      );
    }

    await connection.commit();

    await logCaseEvent(creatorId, "CASE_CREATED", "CASE", caseId, ip, userAgent, {
      caseNumber: case_number,
      cnrNumber: cleanCNR,
      courtId: court_id,
      clientId: primary_client_id,
    });

    return await getCaseById(caseId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Update Case Details
 */
const updateCase = async (id, updates, modifierId = null, ip = null, userAgent = null) => {
  const current = await getCaseById(id);

  const {
    case_number,
    cnr_number,
    court_id,
    case_type,
    case_stage,
    case_status,
    title,
    filing_date,
    registration_date,
    description,
    primary_client_id,
  } = updates;

  const setClauses = [];
  const params = [];

  if (case_number !== undefined) {
    setClauses.push("case_number = ?");
    params.push(String(case_number).trim());
  }

  if (cnr_number !== undefined) {
    const cleanCNR = cnr_number ? String(cnr_number).trim().toUpperCase() : null;
    if (cleanCNR && cleanCNR !== current.cnrNumber) {
      const [existing] = await db.execute(
        `SELECT id FROM cases WHERE cnr_number = ? AND id != ? AND deleted_at IS NULL LIMIT 1`,
        [cleanCNR, id]
      );
      if (existing.length > 0) {
        const err = new Error("A case with this CNR number already exists.");
        err.statusCode = 409;
        err.code = "DUPLICATE_CNR";
        throw err;
      }
    }
    setClauses.push("cnr_number = ?");
    params.push(cleanCNR);
  }

  if (court_id !== undefined) {
    const [crt] = await db.execute(`SELECT id FROM courts WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [court_id]);
    if (crt.length === 0) {
      const err = new Error("Court not found.");
      err.statusCode = 422;
      err.code = "COURT_NOT_FOUND";
      throw err;
    }
    setClauses.push("court_id = ?");
    params.push(court_id);
  }

  if (case_type !== undefined) {
    setClauses.push("case_type = ?");
    params.push(String(case_type).trim());
  }

  if (case_stage !== undefined) {
    if (!ALLOWED_CASE_STAGES.includes(case_stage)) {
      const err = new Error(`Invalid case_stage: ${case_stage}`);
      err.statusCode = 422;
      err.code = "INVALID_STAGE";
      throw err;
    }
    setClauses.push("case_stage = ?");
    params.push(case_stage);
  }

  if (case_status !== undefined) {
    if (!ALLOWED_CASE_STATUSES.includes(case_status)) {
      const err = new Error(`Invalid case_status: ${case_status}`);
      err.statusCode = 422;
      err.code = "INVALID_STATUS";
      throw err;
    }
    setClauses.push("case_status = ?");
    params.push(case_status);
  }

  if (title !== undefined) {
    setClauses.push("title = ?");
    params.push(String(title).trim());
  }

  if (filing_date !== undefined) {
    setClauses.push("filing_date = ?");
    params.push(filing_date ? new Date(filing_date) : null);
  }

  if (registration_date !== undefined) {
    setClauses.push("registration_date = ?");
    params.push(registration_date ? new Date(registration_date) : null);
  }

  if (description !== undefined) {
    setClauses.push("description = ?");
    params.push(description ? String(description).trim() : null);
  }

  if (primary_client_id !== undefined) {
    const [cl] = await db.execute(`SELECT id FROM clients WHERE id = ? LIMIT 1`, [primary_client_id]);
    if (cl.length === 0) {
      const err = new Error("Primary client does not exist.");
      err.statusCode = 422;
      err.code = "CLIENT_NOT_FOUND";
      throw err;
    }
    setClauses.push("primary_client_id = ?");
    params.push(primary_client_id);
  }

  if (setClauses.length === 0) {
    return current;
  }

  setClauses.push("updated_by = ?");
  params.push(modifierId);

  params.push(id);
  await db.execute(`UPDATE cases SET ${setClauses.join(", ")} WHERE id = ?`, params);

  await logCaseEvent(modifierId, "CASE_UPDATED", "CASE", id, ip, userAgent, updates);

  return await getCaseById(id);
};

/**
 * Soft Delete Case
 */
const deleteCase = async (id, modifierId = null, ip = null, userAgent = null) => {
  await db.execute(`UPDATE cases SET deleted_at = NOW() WHERE id = ?`, [id]);
  await logCaseEvent(modifierId, "CASE_DELETED", "CASE", id, ip, userAgent);
  return { success: true, message: "Case file soft-deleted successfully." };
};

module.exports = {
  getCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  ALLOWED_CASE_STAGES,
  ALLOWED_CASE_STATUSES,
};
