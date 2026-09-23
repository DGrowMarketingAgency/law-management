const db = require("../config/database");
const { logCaseEvent } = require("./auditService");

const getAssignmentsByCaseId = async (caseId) => {
  const query = `
    SELECT ca.*, u.first_name, u.last_name, u.email, assigner.first_name as assigner_first, assigner.last_name as assigner_last
    FROM case_assignments ca
    JOIN users u ON ca.user_id = u.id
    LEFT JOIN users assigner ON ca.assigned_by = assigner.id
    WHERE ca.case_id = ? AND ca.is_active = 1
    ORDER BY ca.created_at ASC
  `;
  const [rows] = await db.execute(query, [caseId]);
  return rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    userId: r.user_id,
    name: `${r.first_name} ${r.last_name}`,
    email: r.email,
    roleInCase: r.role_in_case,
    assignedBy: r.assigner_first ? `${r.assigner_first} ${r.assigner_last}` : "Chambers",
    createdAt: r.created_at,
  }));
};

const assignUserToCase = async (caseId, { user_id, role_in_case }, assignerId = null, ip = null, userAgent = null) => {
  if (!user_id) {
    const err = new Error("User ID is required for case assignment.");
    err.statusCode = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  // Check user exists and is active
  const [u] = await db.execute(`SELECT id FROM users WHERE id = ? AND status = 'ACTIVE' LIMIT 1`, [user_id]);
  if (u.length === 0) {
    const err = new Error("User does not exist or is not active.");
    err.statusCode = 422;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  // Check if already assigned
  const [existing] = await db.execute(
    `SELECT id, is_active FROM case_assignments WHERE case_id = ? AND user_id = ? LIMIT 1`,
    [caseId, user_id]
  );

  let assignmentId;
  if (existing.length > 0) {
    assignmentId = existing[0].id;
    await db.execute(
      `UPDATE case_assignments 
       SET is_active = 1, role_in_case = ?, assigned_by = ?, updated_at = NOW() 
       WHERE id = ?`,
      [role_in_case || "ASSIGNED_ASSOCIATE", assignerId, assignmentId]
    );
  } else {
    const [res] = await db.execute(
      `INSERT INTO case_assignments (case_id, user_id, role_in_case, assigned_by, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [caseId, user_id, role_in_case || "ASSIGNED_ASSOCIATE", assignerId]
    );
    assignmentId = res.insertId;
  }

  await logCaseEvent(assignerId, "CASE_ASSIGNED", "CASE", caseId, ip, userAgent, {
    assignedUserId: user_id,
    roleInCase: role_in_case || "ASSIGNED_ASSOCIATE",
  });

  return (await getAssignmentsByCaseId(caseId)).find((a) => a.userId === parseInt(user_id, 10));
};

const unassignUserFromCase = async (caseId, assignmentId, modifierId = null, ip = null, userAgent = null) => {
  await db.execute(`UPDATE case_assignments SET is_active = 0 WHERE id = ? AND case_id = ?`, [assignmentId, caseId]);
  await logCaseEvent(modifierId, "CASE_UNASSIGNED", "CASE", caseId, ip, userAgent, { assignmentId });
  return { success: true, message: "User unassigned from case." };
};

module.exports = {
  getAssignmentsByCaseId,
  assignUserToCase,
  unassignUserFromCase,
};
